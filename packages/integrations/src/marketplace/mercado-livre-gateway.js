import { assertRealOutboundAllowed, } from "../gateway-context.js";
export class MercadoLivreFakeGateway {
    getOrderFees(_context, _orderId) {
        void _context;
        void _orderId;
        return Promise.resolve("18.90");
    }
}
export class MercadoLivreRealGateway {
    #options;
    #fetch;
    #timeoutMs;
    constructor(options) {
        this.#options = typeof options === "boolean" ? null : options;
        this.#fetch =
            typeof options === "boolean" ? fetch : (options.fetch ?? fetch);
        this.#timeoutMs =
            typeof options === "boolean" ? 30_000 : (options.timeoutMs ?? 30_000);
    }
    async getOrderFees(context, orderId) {
        assertRealOutboundAllowed("Mercado Livre", context, this.#options?.globalDemoMode ?? false);
        if (!this.#options)
            throw new Error("MercadoLivreRealGatewayNotConfigured");
        if (!/^\d+$/.test(orderId))
            throw new Error("MercadoLivreInvalidOrderId");
        const order = await this.#order(context, orderId, true);
        return calculateFees(order).toFixed(2);
    }
    async #order(context, orderId, retryUnauthorized) {
        const token = await this.#options.tokenProvider.getAccessToken(context.tenantId, context.correlationId);
        const response = await this.#fetch(`https://api.mercadolibre.com/orders/${encodeURIComponent(orderId)}`, {
            headers: {
                accept: "application/json",
                authorization: `Bearer ${token}`,
                "x-correlation-id": context.correlationId,
            },
            signal: AbortSignal.timeout(this.#timeoutMs),
        });
        if (response.status === 401 && retryUnauthorized) {
            await this.#options.tokenProvider.handleUnauthorized(context.tenantId, context.correlationId);
            return this.#order(context, orderId, false);
        }
        if (!response.ok)
            throw new Error(`MercadoLivreHttpError:${response.status}`);
        const payload = await response.json().catch(() => null);
        if (typeof payload !== "object" ||
            payload === null ||
            Array.isArray(payload))
            throw new Error("MercadoLivreInvalidPayload");
        return payload;
    }
}
function calculateFees(order) {
    const paymentFees = arrayValue(order["payments"]).reduce((sum, raw) => {
        const payment = record(raw);
        return sum + numericValue(payment?.["marketplace_fee"]);
    }, 0);
    if (paymentFees > 0)
        return paymentFees;
    return arrayValue(order["order_items"]).reduce((sum, raw) => {
        const item = record(raw);
        const quantity = Math.max(1, numericValue(item?.["quantity"]));
        return sum + numericValue(item?.["sale_fee"]) * quantity;
    }, 0);
}
function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}
function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function numericValue(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value !== "string")
        return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
