import {
  assertRealOutboundAllowed,
  type GatewayContext,
} from "../gateway-context.js";

export interface MercadoLivreGateway {
  getOrderFees(context: GatewayContext, orderId: string): Promise<string>;
}

export interface MercadoLivreAccessTokenProvider {
  getAccessToken(tenantId: string, correlationId: string): Promise<string>;
  handleUnauthorized(tenantId: string, correlationId: string): Promise<void>;
}

interface MercadoLivreRealGatewayOptions {
  globalDemoMode: boolean;
  tokenProvider: MercadoLivreAccessTokenProvider;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class MercadoLivreFakeGateway implements MercadoLivreGateway {
  getOrderFees(_context: GatewayContext, _orderId: string): Promise<string> {
    void _context;
    void _orderId;
    return Promise.resolve("18.90");
  }
}

export class MercadoLivreRealGateway implements MercadoLivreGateway {
  readonly #options: MercadoLivreRealGatewayOptions | null;
  readonly #globalDemoMode: boolean;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: MercadoLivreRealGatewayOptions | boolean) {
    this.#options = typeof options === "boolean" ? null : options;
    this.#globalDemoMode =
      typeof options === "boolean" ? options : options.globalDemoMode;
    this.#fetch =
      typeof options === "boolean" ? fetch : (options.fetch ?? fetch);
    this.#timeoutMs =
      typeof options === "boolean" ? 30_000 : (options.timeoutMs ?? 30_000);
  }

  async getOrderFees(
    context: GatewayContext,
    orderId: string,
  ): Promise<string> {
    assertRealOutboundAllowed("Mercado Livre", context, this.#globalDemoMode);
    if (!this.#options) throw new Error("MercadoLivreRealGatewayNotConfigured");
    if (!/^\d+$/.test(orderId)) throw new Error("MercadoLivreInvalidOrderId");
    const order = await this.#order(context, orderId, true);
    return calculateFees(order).toFixed(2);
  }

  async #order(
    context: GatewayContext,
    orderId: string,
    retryUnauthorized: boolean,
  ): Promise<Record<string, unknown>> {
    const token = await this.#options!.tokenProvider.getAccessToken(
      context.tenantId,
      context.correlationId,
    );
    const response = await this.#fetch(
      `https://api.mercadolibre.com/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          "x-correlation-id": context.correlationId,
        },
        signal: AbortSignal.timeout(this.#timeoutMs),
      },
    );
    if (response.status === 401 && retryUnauthorized) {
      await this.#options!.tokenProvider.handleUnauthorized(
        context.tenantId,
        context.correlationId,
      );
      return this.#order(context, orderId, false);
    }
    if (!response.ok)
      throw new Error(`MercadoLivreHttpError:${response.status}`);
    const payload: unknown = await response.json().catch(() => null);
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    )
      throw new Error("MercadoLivreInvalidPayload");
    return payload as Record<string, unknown>;
  }
}

function calculateFees(order: Record<string, unknown>): number {
  const paymentFees = arrayValue(order["payments"]).reduce<number>(
    (sum, raw) => {
      const payment = record(raw);
      return sum + numericValue(payment?.["marketplace_fee"]);
    },
    0,
  );
  if (paymentFees > 0) return paymentFees;
  return arrayValue(order["order_items"]).reduce<number>((sum, raw) => {
    const item = record(raw);
    const quantity = Math.max(1, numericValue(item?.["quantity"]));
    return sum + numericValue(item?.["sale_fee"]) * quantity;
  }, 0);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function numericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
