import { assertRealOutboundAllowed, } from "../gateway-context.js";
export class ApChatFakeGateway {
    deliver(context, message) {
        return Promise.resolve({
            externalId: `demo-${context.tenantId}-${message.idempotencyKey}`,
            accepted: true,
        });
    }
}
export class ApChatRealGateway {
    #fetch;
    #baseUrl;
    #timeoutMs;
    #options;
    constructor(options) {
        this.#options = typeof options === "boolean" ? null : options;
        this.#fetch =
            typeof options === "boolean" ? fetch : (options.fetch ?? fetch);
        this.#baseUrl =
            typeof options === "boolean"
                ? "https://api1.apchat.com.br/v2/api/external"
                : (options.baseUrl ?? "https://api1.apchat.com.br/v2/api/external");
        this.#timeoutMs =
            typeof options === "boolean" ? 30_000 : (options.timeoutMs ?? 30_000);
    }
    async deliver(context, message) {
        assertRealOutboundAllowed("APChat", context, this.#options?.globalDemoMode ?? false);
        if (!this.#options)
            throw new Error("APChatRealGatewayNotConfigured");
        const credentials = await this.#options.credentials.getCredentials(context.tenantId);
        if (!/^[A-Za-z0-9-]+$/.test(credentials.uuid))
            throw new Error("ApChatInvalidUuid");
        const recipient = normalizeBrazilianPhone(credentials.testRecipient ?? message.recipient);
        const endpoint = `${this.#baseUrl.replace(/\/$/, "")}/${encodeURIComponent(credentials.uuid)}`;
        const response = await this.#fetch(endpoint, {
            method: "POST",
            headers: {
                accept: "application/json",
                authorization: `Bearer ${credentials.token}`,
                "content-type": "application/json",
                "x-correlation-id": context.correlationId,
            },
            body: JSON.stringify({
                body: message.body,
                number: recipient,
                externalKey: message.idempotencyKey,
                isClosed: !credentials.messagesOpen,
            }),
            signal: AbortSignal.timeout(this.#timeoutMs),
        });
        const responseBody = await response.text();
        const normalizedBody = responseBody.toLowerCase();
        if (!response.ok ||
            normalizedBody.includes("message sent erro") ||
            normalizedBody.includes('"error"')) {
            const detail = responseErrorDetail(responseBody, credentials.token);
            throw new Error(`ApChatHttpError:${response.status}${detail ? `:${detail}` : ""}`);
        }
        const externalId = responseExternalId(responseBody) ?? message.idempotencyKey;
        return { externalId, accepted: true };
    }
}
function responseErrorDetail(body, token) {
    try {
        const parsed = JSON.parse(body);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
            return undefined;
        const record = parsed;
        for (const key of ["error", "message"]) {
            const value = record[key];
            if (typeof value !== "string" || value.length === 0)
                continue;
            return value
                .replaceAll(token, "[credencial protegida]")
                .replace(/[\r\n\t]+/g, " ")
                .slice(0, 200);
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
function normalizeBrazilianPhone(value) {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0)
        throw new Error("ApChatRecipientRequired");
    return digits.length <= 11 ? `55${digits}` : digits;
}
function responseExternalId(body) {
    try {
        const parsed = JSON.parse(body);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
            return undefined;
        const record = parsed;
        for (const key of ["id", "messageId", "externalId", "externalKey"]) {
            const value = record[key];
            if (typeof value === "string" && value.length > 0)
                return value;
            if (typeof value === "number" && Number.isFinite(value))
                return String(value);
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
