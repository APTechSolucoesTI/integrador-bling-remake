import { assertRealOutboundAllowed, } from "../gateway-context.js";
export class BlingTokenRefreshCoordinator {
    options;
    #now;
    constructor(options) {
        this.options = options;
        this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    }
    async refreshIfNeeded(cause, context) {
        const observed = await this.options.tokens.findByTenant(context.tenantId);
        if (!observed) {
            await this.#audit(context, "not_found");
            return false;
        }
        return this.options.lock.runExclusive(`bling:refresh:${context.tenantId}`, 35_000, async () => {
            const current = await this.options.tokens.findByTenant(context.tenantId);
            if (!current) {
                await this.#audit(context, "not_found");
                return false;
            }
            if (current.status === "N")
                return false;
            const anotherWorkerAlreadyRefreshed = current.accessToken !== observed.accessToken &&
                current.expiresAtEpochSeconds > this.#now();
            const tokenStillValid = cause === "expires" &&
                current.expiresAtEpochSeconds > this.#now() + 30;
            if (anotherWorkerAlreadyRefreshed || tokenStillValid)
                return true;
            await this.options.tokens.save({ ...current, status: "R" });
            const credentials = await this.options.credentials.getCredentials(context.tenantId);
            let result;
            try {
                result = await this.options.oauth.refresh(context, credentials, current.refreshToken);
            }
            catch (error) {
                await this.options.tokens.save({ ...current, status: "S" });
                await this.#audit(context, "transient_failure", error instanceof Error ? error.name : "UnknownRefreshError");
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
        });
    }
    async #audit(context, outcome, code) {
        await this.options.audit.record({
            tenantId: context.tenantId,
            correlationId: context.correlationId,
            outcome,
            ...(code === undefined ? {} : { code }),
        });
    }
}
export class BlingOAuthHttpGateway {
    options;
    #fetch;
    #timeoutMs;
    constructor(options) {
        this.options = options;
        this.#fetch = options.fetch ?? fetch;
        this.#timeoutMs = options.timeoutMs ?? 30_000;
    }
    async refresh(context, credentials, refreshToken) {
        assertRealOutboundAllowed("Bling OAuth", context, this.options.globalDemoMode);
        const basic = Buffer.from(`${credentials.clientId.trim()}:${credentials.clientSecret.trim()}`).toString("base64");
        const response = await this.#fetch("https://api.bling.com.br/Api/v3/oauth/token", {
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
        });
        const payload = await response.json().catch(() => null);
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
function isInvalidGrant(payload) {
    if (typeof payload !== "object" || payload === null)
        return false;
    const error = payload["error"];
    return (typeof error === "object" &&
        error !== null &&
        error["type"] === "invalid_grant");
}
function isTokenResponse(payload) {
    if (typeof payload !== "object" || payload === null)
        return false;
    const value = payload;
    return (typeof value["access_token"] === "string" &&
        typeof value["refresh_token"] === "string" &&
        (value["expires_in"] === undefined ||
            typeof value["expires_in"] === "number"));
}
