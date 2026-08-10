import { integrationJobSchema } from "@integrador/contracts";
import type {
  ApChatGateway,
  BlingGateway,
  ListNfeInput,
} from "@integrador/integrations";

export class WorkerHandlerNotConfiguredError extends Error {
  constructor(jobType: string) {
    super(`Handler produtivo ainda não configurado para ${jobType}`);
    this.name = "WorkerHandlerNotConfiguredError";
  }
}

export class DemoTenantMismatchError extends Error {
  constructor() {
    super("Worker demo recusou job de outro tenant");
    this.name = "DemoTenantMismatchError";
  }
}

interface ProcessorDependencies {
  demoMode: boolean;
  demoTenantId: string;
  bling: BlingGateway;
  apchat: ApChatGateway;
  production?: {
    syncNfe(
      context: { tenantId: string; correlationId: string; demo: false },
      input: Pick<ListNfeInput, "issuedFrom" | "issuedTo">,
    ): Promise<Record<string, unknown>>;
    syncNfeDetails(
      context: { tenantId: string; correlationId: string; demo: false },
      nfeId: number,
    ): Promise<Record<string, unknown>>;
    syncProducts(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    syncSalesOrders(
      context: { tenantId: string; correlationId: string; demo: false },
      input: { from: string; to: string },
    ): Promise<Record<string, unknown>>;
    deliverApChat(
      context: { tenantId: string; correlationId: string; demo: false },
      message: {
        recipient: string;
        body: string;
        idempotencyKey: string;
      },
    ): Promise<Record<string, unknown>>;
  };
}

export function createIntegrationProcessor(
  dependencies: ProcessorDependencies,
) {
  return async (raw: unknown): Promise<Record<string, unknown>> => {
    const job = integrationJobSchema.parse(raw);
    if (!dependencies.demoMode) {
      if (!dependencies.production)
        throw new WorkerHandlerNotConfiguredError(job.jobType);
      const context = {
        tenantId: job.tenantId,
        correlationId: job.correlationId,
        demo: false as const,
      };
      switch (job.jobType) {
        case "bling.sync-nfe":
          return dependencies.production.syncNfe(context, {
            issuedFrom: stringPayload(job.payload, "from"),
            issuedTo: stringPayload(job.payload, "to"),
          });
        case "nfe.sync-details":
          return dependencies.production.syncNfeDetails(
            context,
            numberPayload(job.payload, "nfeId"),
          );
        case "bling.sync-products":
          return dependencies.production.syncProducts(context);
        case "bling.sync-sales-orders":
          return dependencies.production.syncSalesOrders(context, {
            from: stringPayload(job.payload, "from"),
            to: stringPayload(job.payload, "to"),
          });
        case "apchat.deliver":
          return dependencies.production.deliverApChat(context, {
            recipient: stringPayload(job.payload, "recipient"),
            body: stringPayload(job.payload, "body"),
            idempotencyKey: stringPayload(job.payload, "idempotencyKey"),
          });
        default:
          throw new WorkerHandlerNotConfiguredError(job.jobType);
      }
    }
    if (job.tenantId !== dependencies.demoTenantId) {
      throw new DemoTenantMismatchError();
    }

    const context = {
      tenantId: job.tenantId,
      correlationId: job.correlationId,
      demo: true,
    };

    switch (job.jobType) {
      case "bling.sync-nfe": {
        const issuedFrom = stringPayload(job.payload, "from");
        const issuedTo = stringPayload(job.payload, "to");
        const [authorized, issued] = await Promise.all([
          dependencies.bling.listNfe(context, {
            status: 5,
            issuedFrom,
            issuedTo,
            page: 1,
            limit: 100,
          }),
          dependencies.bling.listNfe(context, {
            status: 6,
            issuedFrom,
            issuedTo,
            page: 1,
            limit: 100,
          }),
        ]);
        return {
          mode: "demo",
          fetched: authorized.length + issued.length,
          externalIds: [...authorized, ...issued].map((nfe) => nfe.id),
        };
      }
      case "apchat.deliver": {
        const delivery = await dependencies.apchat.deliver(context, {
          recipient: stringPayload(job.payload, "recipient"),
          body: stringPayload(job.payload, "body"),
          idempotencyKey: stringPayload(job.payload, "idempotencyKey"),
        });
        return { mode: "demo", ...delivery };
      }
      case "bling.sync-products":
      case "bling.sync-sales-orders":
        return { mode: "demo", fetched: 0 };
      default:
        throw new WorkerHandlerNotConfiguredError(job.jobType);
    }
  };
}

function stringPayload(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Payload inválido: ${key}`);
  }
  return value;
}

function numberPayload(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Payload inválido: ${key}`);
  }
  return value;
}
