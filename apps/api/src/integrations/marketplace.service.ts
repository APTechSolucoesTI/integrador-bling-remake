import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  marketplaceFeeResponseSchema,
  type MarketplaceFeeResponse,
} from "@integrador/contracts";
import {
  decryptSecret,
  encryptSecret,
  Prisma,
  type DatabaseClient,
} from "@integrador/db";
import {
  MercadoLivreRealGateway,
  type MercadoLivreAccessTokenProvider,
} from "@integrador/integrations";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface MercadoLivreToken {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
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
      tokenProvider: new MercadoLivreTokenProvider(database),
    });
  }

  async orderFees(
    principal: AuthPrincipal,
    orderId: string,
  ): Promise<MarketplaceFeeResponse> {
    if (principal.tenantDemo)
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

class MercadoLivreTokenProvider implements MercadoLivreAccessTokenProvider {
  constructor(private readonly database: DatabaseClient) {}

  async getAccessToken(tenantId: string): Promise<string> {
    const token = await this.token(tenantId);
    if (token.expiresAt && token.expiresAt.getTime() > Date.now() + 120_000)
      return token.accessToken;
    return this.refresh(tenantId, false);
  }

  async handleUnauthorized(tenantId: string): Promise<void> {
    await this.refresh(tenantId, true);
  }

  private async refresh(tenantId: string, force: boolean): Promise<string> {
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          SELECT set_config('lock_timeout', '35000ms', true)
        `);
        await transaction.$queryRaw<Array<{ acquired: number }>>(Prisma.sql`
          WITH acquired_lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${`mercado-livre:refresh:${tenantId}`}, 0))
          )
          SELECT 1::int AS acquired
          FROM acquired_lock
        `);
        const token = await this.token(tenantId, transaction);
        if (
          !force &&
          token.expiresAt &&
          token.expiresAt.getTime() > Date.now() + 120_000
        )
          return token.accessToken;
        if (!token.refreshToken || !token.clientId || !token.clientSecret)
          throw new BadRequestException(
            "Credenciais de renovação do Mercado Livre incompletas",
          );
        await transaction.oAuthCredential.update({
          where: { id: token.id },
          data: { status: "pending" },
        });
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
          await transaction.oAuthCredential.update({
            where: { id: token.id },
            data: {
              status: response.status === 400 ? "expired" : "error",
              lastError:
                response.status === 400
                  ? "Autorização expirada"
                  : "Falha temporária na renovação",
            },
          });
          throw new BadRequestException(
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
          throw new BadRequestException(
            "Resposta de renovação do Mercado Livre inválida",
          );
        const expiresIn =
          typeof value["expires_in"] === "number" && value["expires_in"] > 0
            ? value["expires_in"]
            : 21_600;
        await transaction.oAuthCredential.update({
          where: { id: token.id },
          data: {
            accessTokenCiphertext: encryptSecret(value["access_token"]),
            refreshTokenCiphertext: encryptSecret(value["refresh_token"]),
            accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1_000),
            status: "connected",
            lastError: null,
          },
        });
        return value["access_token"];
      },
      { maxWait: 35_000, timeout: 70_000 },
    );
  }

  private async token(
    tenantId: string,
    client: DatabaseClient | Prisma.TransactionClient = this.database,
  ): Promise<MercadoLivreToken> {
    const credential = await client.oAuthCredential.findUnique({
      where: {
        tenantId_kind: { tenantId, kind: "mercado_livre" },
      },
    });
    const accessToken = decode(credential?.accessTokenCiphertext ?? null);
    if (!credential || credential.status !== "connected" || !accessToken)
      throw new BadRequestException(
        "Mercado Livre não conectado para esta empresa",
      );
    return {
      id: credential.id,
      accessToken,
      refreshToken: decode(credential.refreshTokenCiphertext),
      expiresAt: credential.accessTokenExpiresAt,
      clientId:
        decode(credential.clientIdCiphertext) ??
        process.env["MERCADO_LIVRE_CLIENT_ID"] ??
        null,
      clientSecret:
        decode(credential.clientSecretCiphertext) ??
        process.env["MERCADO_LIVRE_CLIENT_SECRET"] ??
        null,
    };
  }
}

function decode(value: Uint8Array | null): string | null {
  return decryptSecret(value);
}
