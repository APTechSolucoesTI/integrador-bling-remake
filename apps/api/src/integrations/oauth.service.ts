import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma, type DatabaseClient } from "@integrador/db";
import { DATABASE_CLIENT } from "../database/database.module.js";

type IntegrationKind = "bling" | "mercado_livre";

interface OAuthUnitRow {
  id: number;
  name: string;
  clientId: string | null;
  clientSecret: string | null;
}

interface TenantIdRow {
  id: string;
}

interface OAuthTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class OAuthService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async completeBling(code: string, state: string): Promise<void> {
    const unit = await this.blingUnit(state);
    const token = await this.exchangeBling(unit, code);
    const expiresAt = Math.floor(Date.now() / 1_000) + token.expiresIn;
    const correlationId = randomUUID();
    await this.database.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<OAuthUnitRow[]>(Prisma.sql`
        SELECT id, name, client_id AS "clientId", client_secret AS "clientSecret"
        FROM system_unit
        WHERE id=${unit.id}
          AND state=${state}
          AND NULLIF(BTRIM(used_at), '') IS NULL
        FOR UPDATE
      `);
      if (!locked[0])
        throw new BadRequestException("State do Bling já utilizado");
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO bling_tokens (
          unit_id, nome_unit_id, access_token, refresh_token, expires_in, updated_at, status
        ) VALUES (
          ${unit.id}, ${unit.name}, ${token.accessToken}, ${token.refreshToken}, ${expiresAt}, NOW(), 'S'
        )
        ON CONFLICT (unit_id) DO UPDATE SET
          nome_unit_id=EXCLUDED.nome_unit_id,
          access_token=EXCLUDED.access_token,
          refresh_token=EXCLUDED.refresh_token,
          expires_in=EXCLUDED.expires_in,
          updated_at=EXCLUDED.updated_at,
          status='S'
      `);
      await transaction.$executeRaw(Prisma.sql`
        UPDATE system_unit SET used_at=NOW()::text WHERE id=${unit.id} AND state=${state}
      `);
      await this.auditConnection(transaction, unit.id, "bling", correlationId);
    });
  }

  async completeMercadoLivre(code: string, state: string): Promise<void> {
    const unit = await this.mercadoLivreUnit(state);
    const token = await this.exchangeMercadoLivre(unit, code);
    const expiresAt = Math.floor(Date.now() / 1_000) + token.expiresIn;
    const correlationId = randomUUID();
    await this.database.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<OAuthUnitRow[]>(Prisma.sql`
        SELECT id, name, ml_client_id AS "clientId", ml_client_secret AS "clientSecret"
        FROM system_unit
        WHERE id=${unit.id}
          AND ml_state=${state}
          AND NULLIF(BTRIM(ml_used_at), '') IS NULL
        FOR UPDATE
      `);
      if (!locked[0])
        throw new BadRequestException("State do Mercado Livre já utilizado");
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO mercadolivre_tokens (
          unit_id, nome_unit_id, access_token, refresh_token, expires_in, updated_at, status
        ) VALUES (
          ${unit.id}, ${unit.name}, ${token.accessToken}, ${token.refreshToken}, ${expiresAt}, NOW(), 'S'
        )
        ON CONFLICT (unit_id) DO UPDATE SET
          nome_unit_id=EXCLUDED.nome_unit_id,
          access_token=EXCLUDED.access_token,
          refresh_token=EXCLUDED.refresh_token,
          expires_in=EXCLUDED.expires_in,
          updated_at=EXCLUDED.updated_at,
          status='S'
      `);
      await transaction.$executeRaw(Prisma.sql`
        UPDATE system_unit SET ml_used_at=NOW()::text WHERE id=${unit.id} AND ml_state=${state}
      `);
      await this.auditConnection(
        transaction,
        unit.id,
        "mercado_livre",
        correlationId,
      );
    });
  }

  redirectUrl(kind: IntegrationKind): string {
    const configured = process.env["WEB_APP_URL"] ?? "http://localhost:3000";
    let url: URL;
    try {
      url = new URL("/app/operations", configured);
    } catch {
      url = new URL("http://localhost:3000/app/operations");
    }
    url.searchParams.set("oauth", "connected");
    url.searchParams.set("integration", kind);
    return url.toString();
  }

  private async blingUnit(state: string): Promise<OAuthUnitRow> {
    const rows = await this.database.$queryRaw<OAuthUnitRow[]>(Prisma.sql`
      SELECT id, name, client_id AS "clientId", client_secret AS "clientSecret"
      FROM system_unit
      WHERE state=${state}
        AND NULLIF(BTRIM(used_at), '') IS NULL
      LIMIT 1
    `);
    return this.validUnit(rows[0], "Bling");
  }

  private async mercadoLivreUnit(state: string): Promise<OAuthUnitRow> {
    const rows = await this.database.$queryRaw<OAuthUnitRow[]>(Prisma.sql`
      SELECT id, name, ml_client_id AS "clientId", ml_client_secret AS "clientSecret"
      FROM system_unit
      WHERE ml_state=${state}
        AND NULLIF(BTRIM(ml_used_at), '') IS NULL
      LIMIT 1
    `);
    return this.validUnit(rows[0], "Mercado Livre");
  }

  private validUnit(
    unit: OAuthUnitRow | undefined,
    integration: string,
  ): OAuthUnitRow {
    if (!unit)
      throw new BadRequestException(
        `State do ${integration} inválido ou expirado`,
      );
    if (!unit.clientId || !unit.clientSecret)
      throw new BadRequestException(
        `Credenciais do ${integration} não configuradas`,
      );
    return unit;
  }

  private async exchangeBling(
    unit: OAuthUnitRow,
    code: string,
  ): Promise<OAuthTokenPayload> {
    const basic = Buffer.from(`${unit.clientId}:${unit.clientSecret}`).toString(
      "base64",
    );
    const response = await fetch(
      "https://api.bling.com.br/Api/v3/oauth/token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded",
          "enable-jwt": "1",
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    return this.tokenPayload(response, "Bling", 3_600);
  }

  private async exchangeMercadoLivre(
    unit: OAuthUnitRow,
    code: string,
  ): Promise<OAuthTokenPayload> {
    const redirectUri = process.env["MERCADO_LIVRE_REDIRECT_URI"];
    if (!redirectUri)
      throw new BadRequestException(
        "Redirect URI do Mercado Livre não configurado",
      );
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: unit.clientId!,
        client_secret: unit.clientSecret!,
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    return this.tokenPayload(response, "Mercado Livre", 21_600);
  }

  private async tokenPayload(
    response: Response,
    integration: string,
    defaultExpiresIn: number,
  ): Promise<OAuthTokenPayload> {
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof payload !== "object" || payload === null)
      throw new BadRequestException(
        `Não foi possível concluir o OAuth do ${integration}`,
      );
    const value = payload as Record<string, unknown>;
    if (
      typeof value["access_token"] !== "string" ||
      typeof value["refresh_token"] !== "string"
    )
      throw new BadRequestException(
        `Tokens inválidos retornados pelo ${integration}`,
      );
    return {
      accessToken: value["access_token"],
      refreshToken: value["refresh_token"],
      expiresIn:
        typeof value["expires_in"] === "number" && value["expires_in"] > 0
          ? value["expires_in"]
          : defaultExpiresIn,
    };
  }

  private async auditConnection(
    transaction: Prisma.TransactionClient,
    legacyUnitId: number,
    kind: IntegrationKind,
    correlationId: string,
  ): Promise<void> {
    const tenants = await transaction.$queryRaw<TenantIdRow[]>(Prisma.sql`
      SELECT id FROM saas_tenant WHERE legacy_unit_id=${legacyUnitId} LIMIT 1
    `);
    if (!tenants[0]) return;
    await transaction.auditLog.create({
      data: {
        tenantId: tenants[0].id,
        actorUserId: null,
        action: `${kind}.oauth.connected`,
        entityType: "integration",
        entityId: kind,
        correlationId,
        metadata: {},
      },
    });
  }
}
