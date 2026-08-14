import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  decryptSecret,
  encryptSecret,
  type DatabaseClient,
} from "@integrador/db";
import { DATABASE_CLIENT } from "../database/database.module.js";

type IntegrationKind = "bling" | "mercado_livre";

interface OAuthContext {
  credentialId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
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
    const context = await this.context("bling", state);
    const token = await this.exchangeBling(context, code);
    await this.persist(context, "bling", state, token);
  }

  async completeMercadoLivre(code: string, state: string): Promise<void> {
    const context = await this.context("mercado_livre", state);
    const token = await this.exchangeMercadoLivre(context, code);
    await this.persist(context, "mercado_livre", state, token);
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

  private async context(
    kind: IntegrationKind,
    state: string,
  ): Promise<OAuthContext> {
    const credential = await this.database.oAuthCredential.findFirst({
      where: {
        kind,
        status: "pending",
        authorizationStateHash: hashState(state),
        authorizationExpiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        tenantId: true,
        clientIdCiphertext: true,
        clientSecretCiphertext: true,
      },
    });
    if (!credential)
      throw new BadRequestException(
        "State OAuth inválido, expirado ou já utilizado",
      );
    const prefix = kind === "bling" ? "BLING" : "MERCADO_LIVRE";
    const clientId =
      decode(credential.clientIdCiphertext) ??
      process.env[`${prefix}_CLIENT_ID`];
    const clientSecret =
      decode(credential.clientSecretCiphertext) ??
      process.env[`${prefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret)
      throw new BadRequestException("Credenciais OAuth não configuradas");
    return {
      credentialId: credential.id,
      tenantId: credential.tenantId,
      clientId,
      clientSecret,
    };
  }

  private async persist(
    context: OAuthContext,
    kind: IntegrationKind,
    state: string,
    token: OAuthTokenPayload,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + token.expiresIn * 1_000);
    await this.database.$transaction(async (transaction) => {
      const claimed = await transaction.oAuthCredential.updateMany({
        where: {
          id: context.credentialId,
          status: "pending",
          authorizationStateHash: hashState(state),
          authorizationExpiresAt: { gt: new Date() },
        },
        data: {
          accessTokenCiphertext: encryptSecret(token.accessToken),
          refreshTokenCiphertext: encryptSecret(token.refreshToken),
          accessTokenExpiresAt: expiresAt,
          authorizationStateHash: null,
          authorizationExpiresAt: null,
          connectedAt: new Date(),
          status: "connected",
          lastError: null,
        },
      });
      if (claimed.count !== 1)
        throw new BadRequestException("State OAuth já utilizado");
      await transaction.auditLog.create({
        data: {
          tenantId: context.tenantId,
          actorUserId: null,
          action: `${kind}.oauth.connected`,
          entityType: "integration",
          entityId: kind,
          correlationId: randomUUID(),
          metadata: {},
        },
      });
    });
  }

  private async exchangeBling(
    context: OAuthContext,
    code: string,
  ): Promise<OAuthTokenPayload> {
    const basic = Buffer.from(
      `${context.clientId}:${context.clientSecret}`,
    ).toString("base64");
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
    context: OAuthContext,
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
        client_id: context.clientId,
        client_secret: context.clientSecret,
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
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function decode(value: Uint8Array | null): string | undefined {
  return decryptSecret(value) ?? undefined;
}
