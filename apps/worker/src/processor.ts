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
      input: Pick<ListNfeInput, "issuedFrom" | "issuedTo"> & {
        autoDeliver?: boolean;
      },
    ): Promise<Record<string, unknown>>;
    syncNfeDetails(
      context: { tenantId: string; correlationId: string; demo: false },
      nfeId: number,
    ): Promise<Record<string, unknown>>;
    processNfeXml(
      context: { tenantId: string; correlationId: string; demo: false },
      nfeId: number,
    ): Promise<Record<string, unknown>>;
    syncCancelledNfe(
      context: { tenantId: string; correlationId: string; demo: false },
      input: Pick<ListNfeInput, "issuedFrom" | "issuedTo">,
    ): Promise<Record<string, unknown>>;
    deliverNfe(
      context: { tenantId: string; correlationId: string; demo: false },
      nfeId: number,
    ): Promise<Record<string, unknown>>;
    updateContact(
      context: { tenantId: string; correlationId: string; demo: false },
      input: {
        nfeId: number;
        contactId: number;
        contactBlingId: string;
        mobilePhone: string;
        messagingDisabled: boolean;
      },
    ): Promise<Record<string, unknown>>;
    deliverSatisfactionSurveys(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    processExpiredGoals(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    syncProducts(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    syncPaymentMethods(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    syncSalesChannels(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    syncSellers(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    syncOperationNatures(context: {
      tenantId: string;
      correlationId: string;
      demo: false;
    }): Promise<Record<string, unknown>>;
    refreshBlingToken(context: {
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
        case "bling.sync-daily-integrity": {
          const from = stringPayload(job.payload, "from");
          const to = stringPayload(job.payload, "to");
          const paymentMethods =
            await dependencies.production.syncPaymentMethods(context);
          const salesChannels =
            await dependencies.production.syncSalesChannels(context);
          const sellers = await dependencies.production.syncSellers(context);
          const operationNatures =
            await dependencies.production.syncOperationNatures(context);
          const products = await dependencies.production.syncProducts(context);
          const salesOrders = await dependencies.production.syncSalesOrders(
            context,
            { from, to },
          );
          const cancelledNfe = await dependencies.production.syncCancelledNfe(
            context,
            {
              issuedFrom: stringPayload(job.payload, "cancelledFrom"),
              issuedTo: stringPayload(job.payload, "cancelledTo"),
            },
          );
          const nfe = await dependencies.production.syncNfe(context, {
            issuedFrom: from,
            issuedTo: to,
          });
          return {
            mode: "production",
            from,
            to,
            paymentMethods,
            salesChannels,
            sellers,
            operationNatures,
            products,
            salesOrders,
            cancelledNfe,
            nfe,
          };
        }
        case "bling.sync-nfe":
          return dependencies.production.syncNfe(context, {
            issuedFrom: stringPayload(job.payload, "from"),
            issuedTo: stringPayload(job.payload, "to"),
            ...(job.payload["autoDeliver"] === true
              ? { autoDeliver: true }
              : {}),
          });
        case "nfe.sync-details":
          return dependencies.production.syncNfeDetails(
            context,
            numberPayload(job.payload, "nfeId"),
          );
        case "nfe.process-xml":
          return dependencies.production.processNfeXml(
            context,
            numberPayload(job.payload, "nfeId"),
          );
        case "bling.sync-cancelled-nfe":
          return dependencies.production.syncCancelledNfe(context, {
            issuedFrom: stringPayload(job.payload, "from"),
            issuedTo: stringPayload(job.payload, "to"),
          });
        case "nfe.deliver":
          return dependencies.production.deliverNfe(
            context,
            numberPayload(job.payload, "nfeId"),
          );
        case "contact.update":
          return dependencies.production.updateContact(context, {
            nfeId: numberPayload(job.payload, "nfeId"),
            contactId: numberPayload(job.payload, "contactId"),
            contactBlingId: stringPayload(job.payload, "contactBlingId"),
            mobilePhone: optionalStringPayload(job.payload, "mobilePhone"),
            messagingDisabled: booleanPayload(job.payload, "messagingDisabled"),
          });
        case "satisfaction.deliver":
          return dependencies.production.deliverSatisfactionSurveys(context);
        case "goals.process-expired":
          return dependencies.production.processExpiredGoals(context);
        case "bling.sync-products":
          return dependencies.production.syncProducts(context);
        case "bling.sync-payment-methods":
          return dependencies.production.syncPaymentMethods(context);
        case "bling.sync-sales-channels":
          return dependencies.production.syncSalesChannels(context);
        case "bling.sync-sellers":
          return dependencies.production.syncSellers(context);
        case "bling.sync-operation-natures":
          return dependencies.production.syncOperationNatures(context);
        case "bling.refresh-token":
          return dependencies.production.refreshBlingToken(context);
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
      case "bling.sync-daily-integrity":
        return {
          mode: "demo",
          from: stringPayload(job.payload, "from"),
          to: stringPayload(job.payload, "to"),
          synchronized: false,
        };
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
      case "bling.sync-cancelled-nfe":
        return { mode: "demo", updated: 0 };
      case "apchat.deliver": {
        const delivery = await dependencies.apchat.deliver(context, {
          recipient: stringPayload(job.payload, "recipient"),
          body: stringPayload(job.payload, "body"),
          idempotencyKey: stringPayload(job.payload, "idempotencyKey"),
        });
        return { mode: "demo", ...delivery };
      }
      case "nfe.deliver":
        return {
          mode: "demo",
          nfeId: numberPayload(job.payload, "nfeId"),
          accepted: true,
        };
      case "nfe.sync-details":
        return {
          mode: "demo",
          nfeId: numberPayload(job.payload, "nfeId"),
          synchronized: true,
        };
      case "nfe.process-xml":
        return {
          mode: "demo",
          nfeId: numberPayload(job.payload, "nfeId"),
          calculated: true,
        };
      case "contact.update":
        return { mode: "demo", updated: false };
      case "satisfaction.deliver":
        return { mode: "demo", delivered: 0 };
      case "goals.process-expired":
        return { mode: "demo", processed: 0 };
      case "bling.sync-products":
      case "bling.sync-sales-orders":
        return { mode: "demo", fetched: 0 };
      case "bling.sync-payment-methods": {
        const items = await dependencies.bling.listPaymentMethods(context);
        return { mode: "demo", fetched: items.length };
      }
      case "bling.sync-sales-channels": {
        const items = await dependencies.bling.listSalesChannels(context);
        return { mode: "demo", fetched: items.length };
      }
      case "bling.sync-sellers": {
        const items = await dependencies.bling.listSellers(context);
        return { mode: "demo", fetched: items.length };
      }
      case "bling.sync-operation-natures": {
        const items = await dependencies.bling.listOperationNatures(context);
        return { mode: "demo", fetched: items.length };
      }
      case "bling.refresh-token":
        return { mode: "demo", refreshed: false };
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

function optionalStringPayload(
  payload: Record<string, unknown>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== "string") throw new Error(`Payload invÃ¡lido: ${key}`);
  return value;
}

function booleanPayload(
  payload: Record<string, unknown>,
  key: string,
): boolean {
  const value = payload[key];
  if (typeof value !== "boolean") throw new Error(`Payload invÃ¡lido: ${key}`);
  return value;
}
