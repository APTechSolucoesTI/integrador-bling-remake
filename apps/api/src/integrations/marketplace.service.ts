import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  marketplaceFeeResponseSchema,
  type MarketplaceFeeResponse,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import {
  MercadoLivreRealGateway,
  type MercadoLivreAccessTokenProvider,
} from "@integrador/integrations";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface MercadoLivreTokenRow {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: bigint | number | null;
  status: string | null;
  clientId: string | null;
  clientSecret: string | null;
}

@Injectable()
export class MarketplaceService {
  readonly #gateway: MercadoLivreRealGateway;

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {
    this.#gateway = new MercadoLivreRealGateway({
      globalDemoMode: false,
      tokenProvider: new LegacyMercadoLivreTokenProvider(database),
    });
  }

  async orderFees(
    principal: AuthPrincipal,
    orderId: string,
  ): Promise<MarketplaceFeeResponse> {
    if (principal.tenantDemo || principal.legacyUnitId === null)
      throw new BadRequestException("Empresa sem integração produtiva");
    if (!/^\d+$/.test(orderId))
      throw new BadRequestException("Order do Mercado Livre inválida");
    const correlationId = randomUUID();
    const fee = await this.#gateway.getOrderFees(
      {
        tenantId: principal.activeTenantId,
        correlationId,
        demo: false,
      },
      orderId,
    );
    await this.database.auditLog.create({
      data: {
        tenantId: principal.activeTenantId,
        actorUserId: principal.userId,
        action: "mercado_livre.order.fees_read",
        entityType: "marketplace_order",
        entityId: orderId,
        correlationId,
        metadata: {},
      },
    });
    return marketplaceFeeResponseSchema.parse({ orderId, fee });
  }
}

class LegacyMercadoLivreTokenProvider implements MercadoLivreAccessTokenProvider {
  constructor(private readonly database: DatabaseClient) {}

  async getAccessToken(
    tenantId: string,
    _correlationId: string,
  ): Promise<string> {
    void _correlationId;
    const token = await this.token(tenantId);
    if (
      token.status === "S" &&
      Number(token.expiresAt) > Math.floor(Date.now() / 1_000) + 120
    )
      return token.accessToken!;
    return this.refresh(tenantId, false);
  }

  async handleUnauthorized(
    tenantId: string,
    _correlationId: string,
  ): Promise<void> {
    void _correlationId;
    await this.refresh(tenantId, true);
  }

  private async refresh(tenantId: string, force: boolean): Promise<string> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          await transaction.$queryRaw(Prisma.sql`
          SELECT set_config('lock_timeout', '35000ms', true)
        `);
          await transaction.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${`mercado-livre:refresh:${tenantId}`}, 0))
        `);
          const rows = await transaction.$queryRaw<MercadoLivreTokenRow[]>(
            tokenQuery(tenantId),
          );
          const token = validToken(rows[0]);
          if (
            !force &&
            token.status === "S" &&
            Number(token.expiresAt) > Math.floor(Date.now() / 1_000) + 120
          )
            return token.accessToken!;
          if (!token.refreshToken || !token.clientId || !token.clientSecret)
            throw new BadRequestException(
              "Credenciais de renovação do Mercado Livre incompletas",
            );

          await transaction.$executeRaw(Prisma.sql`
          UPDATE mercadolivre_tokens current
          SET status='R', updated_at=NOW()
          FROM saas_tenant tenant
          WHERE tenant.id=${tenantId}::uuid
            AND current.unit_id=tenant.legacy_unit_id
        `);
          const response = await fetch(
            "https://api.mercadolibre.com/oauth/token",
            {
              method: "POST",
              headers: {
                accept: "application/json",
                "content-type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                grant_type: "refresh_token",
                client_id: token.clientId,
                client_secret: token.clientSecret,
                refresh_token: token.refreshToken,
              }),
              signal: AbortSignal.timeout(30_000),
            },
          );
          const payload: unknown = await response.json().catch(() => null);
          if (!response.ok || typeof payload !== "object" || payload === null) {
            throw new MercadoLivreRefreshError(
              response.status === 400 ? "N" : "S",
              response.status === 400
                ? "Autorização do Mercado Livre expirada; conecte novamente"
                : "Falha temporária ao renovar o Mercado Livre",
            );
          }
          const value = payload as Record<string, unknown>;
          if (
            typeof value["access_token"] !== "string" ||
            typeof value["refresh_token"] !== "string"
          )
            throw new MercadoLivreRefreshError(
              "S",
              "Resposta de renovação do Mercado Livre inválida",
            );
          const expiresIn =
            typeof value["expires_in"] === "number" && value["expires_in"] > 0
              ? value["expires_in"]
              : 21_600;
          const expiresAt = Math.floor(Date.now() / 1_000) + expiresIn;
          await transaction.$executeRaw(Prisma.sql`
          UPDATE mercadolivre_tokens current
          SET access_token=${value["access_token"]},
              refresh_token=${value["refresh_token"]},
              expires_in=${expiresAt},
              status='S',
              updated_at=NOW()
          FROM saas_tenant tenant
          WHERE tenant.id=${tenantId}::uuid
            AND current.unit_id=tenant.legacy_unit_id
        `);
          return value["access_token"];
        },
        { maxWait: 35_000, timeout: 70_000 },
      );
    } catch (error) {
      if (error instanceof MercadoLivreRefreshError) {
        await this.database.$executeRaw(Prisma.sql`
          UPDATE mercadolivre_tokens current
          SET status=${error.status}, updated_at=NOW()
          FROM saas_tenant tenant
          WHERE tenant.id=${tenantId}::uuid
            AND current.unit_id=tenant.legacy_unit_id
        `);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async token(tenantId: string): Promise<MercadoLivreTokenRow> {
    const rows = await this.database.$queryRaw<MercadoLivreTokenRow[]>(
      tokenQuery(tenantId),
    );
    return validToken(rows[0]);
  }
}

class MercadoLivreRefreshError extends Error {
  constructor(
    readonly status: "S" | "N",
    message: string,
  ) {
    super(message);
    this.name = "MercadoLivreRefreshError";
  }
}

function tokenQuery(tenantId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      token.access_token AS "accessToken",
      token.refresh_token AS "refreshToken",
      token.expires_in AS "expiresAt",
      token.status,
      unit.ml_client_id AS "clientId",
      unit.ml_client_secret AS "clientSecret"
    FROM saas_tenant tenant
    JOIN system_unit unit ON unit.id=tenant.legacy_unit_id
    JOIN mercadolivre_tokens token ON token.unit_id=unit.id
    WHERE tenant.id=${tenantId}::uuid
    LIMIT 1
  `;
}

function validToken(
  token: MercadoLivreTokenRow | undefined,
): MercadoLivreTokenRow {
  if (!token?.accessToken || token.expiresAt === null || token.status === "N")
    throw new BadRequestException(
      "Mercado Livre não conectado para esta empresa",
    );
  return token;
}
