import {
  assertRealOutboundAllowed,
  type GatewayContext,
} from "../gateway-context.js";

export type BlingTokenStatus = "S" | "R" | "N";
export type BlingRefreshCause = 401 | "expires";

export interface BlingTokenRecord {
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAtEpochSeconds: number;
  status: BlingTokenStatus;
}

export interface BlingTokenRepository {
  findByTenant(tenantId: string): Promise<BlingTokenRecord | null>;
  save(record: BlingTokenRecord): Promise<void>;
}

export interface BlingClientCredentials {
  clientId: string;
  clientSecret: string;
}

export interface BlingCredentialProvider {
  getCredentials(tenantId: string): Promise<BlingClientCredentials>;
}

export interface DistributedLock {
  runExclusive<T>(
    key: string,
    ttlMs: number,
    operation: () => Promise<T>,
  ): Promise<T>;
}

export type BlingOAuthRefreshResult =
  | {
      kind: "success";
      accessToken: string;
      refreshToken: string;
      expiresInSeconds: number;
    }
  | { kind: "invalid_grant" }
  | { kind: "transient_failure"; code: string };

export interface BlingOAuthGateway {
  refresh(
    context: GatewayContext,
    credentials: BlingClientCredentials,
    refreshToken: string,
  ): Promise<BlingOAuthRefreshResult>;
}

export interface BlingRefreshAudit {
  record(event: {
    tenantId: string;
    correlationId: string;
    outcome: "success" | "revoked" | "transient_failure" | "not_found";
    code?: string;
  }): Promise<void>;
}

interface BlingTokenRefreshCoordinatorOptions {
  tokens: BlingTokenRepository;
  credentials: BlingCredentialProvider;
  lock: DistributedLock;
  oauth: BlingOAuthGateway;
  audit: BlingRefreshAudit;
  now?: () => number;
}

export class BlingTokenRefreshCoordinator {
  readonly #now: () => number;

  constructor(private readonly options: BlingTokenRefreshCoordinatorOptions) {
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  }

  async refreshIfNeeded(
    cause: BlingRefreshCause,
    context: GatewayContext,
  ): Promise<boolean> {
    const observed = await this.options.tokens.findByTenant(context.tenantId);
    if (!observed) {
      await this.#audit(context, "not_found");
      return false;
    }

    return this.options.lock.runExclusive(
      `bling:refresh:${context.tenantId}`,
      35_000,
      async () => {
        const current = await this.options.tokens.findByTenant(
          context.tenantId,
        );
        if (!current) {
          await this.#audit(context, "not_found");
          return false;
        }
        if (current.status === "N") return false;

        const anotherWorkerAlreadyRefreshed =
          current.accessToken !== observed.accessToken &&
          current.expiresAtEpochSeconds > this.#now();
        const tokenStillValid =
          cause === "expires" &&
          current.expiresAtEpochSeconds > this.#now() + 30;
        if (anotherWorkerAlreadyRefreshed || tokenStillValid) return true;

        await this.options.tokens.save({ ...current, status: "R" });
        const credentials = await this.options.credentials.getCredentials(
          context.tenantId,
        );

        let result: BlingOAuthRefreshResult;
        try {
          result = await this.options.oauth.refresh(
            context,
            credentials,
            current.refreshToken,
          );
        } catch (error) {
          await this.options.tokens.save({ ...current, status: "S" });
          await this.#audit(
            context,
            "transient_failure",
            error instanceof Error ? error.name : "UnknownRefreshError",
          );
          return false;
        }

        if (result.kind === "invalid_grant") {
          await this.options.tokens.save({ ...current, status: "N" });
          await this.#audit(context, "revoked", "invalid_grant");
          return false;
        }
        if (result.kind === "transient_failure") {
          await this.options.tokens.save({ ...current, status: "S" });
          await this.#audit(context, "transient_failure", result.code);
          return false;
        }

        await this.options.tokens.save({
          tenantId: context.tenantId,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAtEpochSeconds: this.#now() + result.expiresInSeconds,
          status: "S",
        });
        await this.#audit(context, "success");
        return true;
      },
    );
  }

  async #audit(
    context: GatewayContext,
    outcome: Parameters<BlingRefreshAudit["record"]>[0]["outcome"],
    code?: string,
  ): Promise<void> {
    await this.options.audit.record({
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      outcome,
      ...(code === undefined ? {} : { code }),
    });
  }
}

interface BlingOAuthHttpGatewayOptions {
  globalDemoMode: boolean;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class BlingOAuthHttpGateway implements BlingOAuthGateway {
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(private readonly options: BlingOAuthHttpGatewayOptions) {
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  async refresh(
    context: GatewayContext,
    credentials: BlingClientCredentials,
    refreshToken: string,
  ): Promise<BlingOAuthRefreshResult> {
    assertRealOutboundAllowed(
      "Bling OAuth",
      context,
      this.options.globalDemoMode,
    );
    const basic = Buffer.from(
      `${credentials.clientId.trim()}:${credentials.clientSecret.trim()}`,
    ).toString("base64");
    const response = await this.#fetch(
      "https://api.bling.com.br/Api/v3/oauth/token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded",
          "enable-jwt": "1",
          "x-correlation-id": context.correlationId,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (response.status === 400 && isInvalidGrant(payload)) {
      return { kind: "invalid_grant" };
    }
    if (!response.ok || !isTokenResponse(payload)) {
      return { kind: "transient_failure", code: `http_${response.status}` };
    }
    return {
      kind: "success",
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresInSeconds: payload.expires_in ?? 3_600,
    };
  }
}

function isInvalidGrant(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const error = (payload as Record<string, unknown>)["error"];
  if (error === "invalid_grant") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Record<string, unknown>)["type"] === "invalid_grant"
  );
}

function isTokenResponse(payload: unknown): payload is {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
} {
  if (typeof payload !== "object" || payload === null) return false;
  const value = payload as Record<string, unknown>;
  return (
    typeof value["access_token"] === "string" &&
    typeof value["refresh_token"] === "string" &&
    (value["expires_in"] === undefined ||
      typeof value["expires_in"] === "number")
  );
}
