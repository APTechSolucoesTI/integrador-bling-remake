import {
  assertRealOutboundAllowed,
  type GatewayContext,
} from "../gateway-context.js";

export interface ApChatMessage {
  recipient: string;
  body: string;
  idempotencyKey: string;
}

export interface ApChatDelivery {
  externalId: string;
  accepted: boolean;
}

export interface ApChatGateway {
  deliver(
    context: GatewayContext,
    message: ApChatMessage,
  ): Promise<ApChatDelivery>;
}

export interface ApChatCredentials {
  uuid: string;
  token: string;
  testRecipient?: string;
  messagesOpen: boolean;
}

export interface ApChatCredentialProvider {
  getCredentials(tenantId: string): Promise<ApChatCredentials>;
}

interface ApChatRealGatewayOptions {
  globalDemoMode: boolean;
  credentials: ApChatCredentialProvider;
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

export class ApChatFakeGateway implements ApChatGateway {
  deliver(
    context: GatewayContext,
    message: ApChatMessage,
  ): Promise<ApChatDelivery> {
    return Promise.resolve({
      externalId: `demo-${context.tenantId}-${message.idempotencyKey}`,
      accepted: true,
    });
  }
}

export class ApChatRealGateway implements ApChatGateway {
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #options: ApChatRealGatewayOptions | null;

  constructor(options: ApChatRealGatewayOptions | boolean) {
    this.#options = typeof options === "boolean" ? null : options;
    this.#fetch =
      typeof options === "boolean" ? fetch : (options.fetch ?? fetch);
    this.#baseUrl =
      typeof options === "boolean"
        ? "https://api.apchat.com.br/v2/api/external"
        : (options.baseUrl ?? "https://api.apchat.com.br/v2/api/external");
    this.#timeoutMs =
      typeof options === "boolean" ? 30_000 : (options.timeoutMs ?? 30_000);
  }

  async deliver(
    context: GatewayContext,
    message: ApChatMessage,
  ): Promise<ApChatDelivery> {
    assertRealOutboundAllowed(
      "APChat",
      context,
      this.#options?.globalDemoMode ?? false,
    );
    if (!this.#options) throw new Error("APChatRealGatewayNotConfigured");
    const credentials = await this.#options.credentials.getCredentials(
      context.tenantId,
    );
    if (!/^[A-Za-z0-9-]+$/.test(credentials.uuid))
      throw new Error("ApChatInvalidUuid");
    const recipient = normalizeBrazilianPhone(
      credentials.testRecipient ?? message.recipient,
    );
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
    if (
      !response.ok ||
      normalizedBody.includes("message sent erro") ||
      normalizedBody.includes('"error"')
    ) {
      throw new Error(`ApChatHttpError:${response.status}`);
    }
    const externalId =
      responseExternalId(responseBody) ?? message.idempotencyKey;
    return { externalId, accepted: true };
  }
}

function normalizeBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) throw new Error("ApChatRecipientRequired");
  return digits.length <= 11 ? `55${digits}` : digits;
}

function responseExternalId(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return undefined;
    const record = parsed as Record<string, unknown>;
    for (const key of ["id", "messageId", "externalId", "externalKey"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
      if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    }
  } catch {
    return undefined;
  }
  return undefined;
}
