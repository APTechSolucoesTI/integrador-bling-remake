import { runtimeEnvSchema, type IntegrationJob } from "@integrador/contracts";
import { createPrismaClient } from "@integrador/db";
import type { Prisma } from "@integrador/db";
import { ApChatFakeGateway, BlingFakeGateway } from "@integrador/integrations";
import { createIntegrationProcessor } from "./processor.js";
import { ProductionIntegrationProcessor } from "./production.js";
import { defaultJobOptions, INTEGRATION_QUEUE } from "./queue-policy.js";
import { OperationalScheduler } from "./operational-scheduler.js";

const env = runtimeEnvSchema.parse(process.env);
const database = createPrismaClient(env.DATABASE_URL);

if (process.env["BOOTSTRAP_SMOKE_MODE"] === "true") {
  await database.$queryRaw`SELECT 1`;
  console.info(
    JSON.stringify({
      level: "info",
      service: "worker",
      event: "database.ready",
    }),
  );
  await database.$disconnect();
  process.exit(0);
}

const { Queue, QueueEvents, Worker } = await import("bullmq");
const queue = new Queue(INTEGRATION_QUEUE, {
  connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
  defaultJobOptions,
});
const queueEvents = new QueueEvents(INTEGRATION_QUEUE, {
  connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
});
const processJob = createIntegrationProcessor({
  demoMode: env.DEMO_MODE,
  demoTenantId: env.DEMO_TENANT_ID,
  bling: new BlingFakeGateway(),
  apchat: new ApChatFakeGateway(),
  production: new ProductionIntegrationProcessor(database),
});
const worker = new Worker<IntegrationJob, Record<string, unknown>>(
  INTEGRATION_QUEUE,
  async (job) => {
    const executionId = job.id;
    if (executionId) {
      await database.jobExecution.updateMany({
        where: { id: executionId, tenantId: job.data.tenantId },
        data: {
          status: "active",
          attempt: job.attemptsMade + 1,
          startedAt: new Date(),
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
    }
    try {
      const result = await processJob(job.data);
      if (executionId) {
        const notification = completedNotification(job.data, result);
        await database.$transaction([
          database.jobExecution.updateMany({
            where: { id: executionId, tenantId: job.data.tenantId },
            data: {
              status: "completed",
              finishedAt: new Date(),
              result: result as Prisma.InputJsonValue,
            },
          }),
          database.systemNotification.upsert({
            where: {
              tenantId_sourceKey: {
                tenantId: job.data.tenantId,
                sourceKey: `job:${executionId}:completed`,
              },
            },
            create: {
              tenantId: job.data.tenantId,
              sourceKey: `job:${executionId}:completed`,
              ...notification,
            },
            update: notification,
          }),
        ]);
      }
      return result;
    } catch (error) {
      if (executionId) {
        const willRetry =
          !(error instanceof Error && error.name === "UnrecoverableError") &&
          job.attemptsMade + 1 < (job.opts.attempts ?? 1);
        const errorName =
          error instanceof Error ? error.name : "UnknownWorkerError";
        const errorMessage =
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Falha desconhecida";
        const updates = [
          database.jobExecution.updateMany({
            where: { id: executionId, tenantId: job.data.tenantId },
            data: {
              status: willRetry ? "queued" : "failed",
              finishedAt: willRetry ? null : new Date(),
              errorCode: errorName,
              errorMessage,
            },
          }),
        ];
        if (!willRetry) {
          const notification = failedNotification(
            job.data,
            errorName,
            errorMessage,
          );
          await database.$transaction([
            ...updates,
            database.systemNotification.upsert({
              where: {
                tenantId_sourceKey: {
                  tenantId: job.data.tenantId,
                  sourceKey: `job:${executionId}:failed`,
                },
              },
              create: {
                tenantId: job.data.tenantId,
                sourceKey: `job:${executionId}:failed`,
                ...notification,
              },
              update: notification,
            }),
          ]);
        } else {
          await database.$transaction(updates);
        }
      }
      throw error;
    }
  },
  {
    connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
    concurrency: 5,
    limiter: { max: 3, duration: 1_000 },
    // Sincronizações reais do Bling podem permanecer vários minutos no mesmo
    // job. Uma janela maior evita que uma oscilação breve do Redis/event loop
    // transforme uma execução saudável em stalled.
    lockDuration: 300_000,
    lockRenewTime: 30_000,
    stalledInterval: 60_000,
    maxStalledCount: 3,
  },
);
const scheduler = new OperationalScheduler(database, queue);

worker.on("completed", (job) => {
  console.info(
    JSON.stringify({
      level: "info",
      service: "worker",
      event: "job.completed",
      jobId: job.id,
      jobType: job.name,
    }),
  );
});
worker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      service: "worker",
      event: "job.failed",
      jobId: job?.id,
      jobType: job?.name,
      errorName: error.name,
      errorMessage: error.message.slice(0, 500),
    }),
  );
  const attempts = job?.opts.attempts ?? 1;
  const terminalFailure =
    error.name === "UnrecoverableError" ||
    (job !== undefined && job.attemptsMade >= attempts);
  if (job?.id && terminalFailure) {
    void database.jobExecution
      .updateMany({
        where: { id: job.id, tenantId: job.data.tenantId },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorCode: error.name,
          errorMessage: error.message.slice(0, 500),
        },
      })
      .catch((persistenceError: unknown) => {
        console.error(
          JSON.stringify({
            level: "error",
            service: "worker",
            event: "job.failure_persistence_failed",
            jobId: job.id,
            errorName:
              persistenceError instanceof Error
                ? persistenceError.name
                : "UnknownPersistenceError",
          }),
        );
      });
  }
});

await Promise.all([
  queue.waitUntilReady(),
  queueEvents.waitUntilReady(),
  worker.waitUntilReady(),
]);
console.info(
  JSON.stringify({
    level: "info",
    service: "worker",
    event: "queue.ready",
    queue: INTEGRATION_QUEUE,
  }),
);
scheduler.start();

const shutdown = async (): Promise<void> => {
  scheduler.stop();
  await Promise.all([
    worker.close(),
    queueEvents.close(),
    queue.close(),
    database.$disconnect(),
  ]);
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

type NotificationData = {
  kind: string;
  level: string;
  title: string;
  message: string;
  detail: Prisma.InputJsonObject;
  actionHref: string;
  permission: string;
  occurredAt: Date;
};

function completedNotification(
  job: IntegrationJob,
  result: Record<string, unknown>,
): NotificationData {
  const occurredAt = new Date();
  const detail = safeNotificationDetail(result);
  if (job.jobType === "bling.sync-nfe") {
    const persisted = resultNumber(result, "persisted");
    const delivered = resultNumber(result, "delivered");
    const ignored = resultNumber(result, "ignoredByPolicy");
    return {
      kind: "nfe.sync",
      level: ignored > 0 ? "warning" : "success",
      title: "Sincronização de NF-e concluída",
      message: `${persisted} notas sincronizadas, ${delivered} enviadas e ${ignored} ignoradas pelas regras.`,
      detail: {
        ...detail,
        periodoInicial: job.payload["from"] ?? null,
        periodoFinal: job.payload["to"] ?? null,
      },
      actionHref: notificationNfeHref(job),
      permission: "nfe:view",
      occurredAt,
    };
  }
  if (job.jobType === "nfe.deliver") {
    const nfeId =
      resultNumber(result, "nfeId") || resultNumber(job.payload, "nfeId");
    return {
      kind: "nfe.delivery",
      level: "success",
      title: "NF-e enviada pelo APChat",
      message: `Envio da NF-e ${nfeId} aceito pelo canal de mensagens.`,
      detail,
      actionHref: `/app/nfe/${nfeId}`,
      permission: "nfe:view",
      occurredAt,
    };
  }
  const label = jobLabel(job.jobType);
  return {
    kind: "integration.completed",
    level: "success",
    title: `${label} concluída`,
    message: "Processamento finalizado sem erros.",
    detail,
    actionHref: jobAction(job.jobType),
    permission: jobPermission(job.jobType),
    occurredAt,
  };
}

function failedNotification(
  job: IntegrationJob,
  errorName: string,
  errorMessage: string,
): NotificationData {
  return {
    kind: "integration.failed",
    level: "error",
    title: `${jobLabel(job.jobType)} falhou`,
    message: "A execução terminou com erro e precisa de atenção.",
    detail: {
      erro: errorName,
      mensagem: errorMessage,
      periodoInicial: job.payload["from"] ?? null,
      periodoFinal: job.payload["to"] ?? null,
    },
    actionHref: jobAction(job.jobType),
    permission: jobPermission(job.jobType),
    occurredAt: new Date(),
  };
}

function safeNotificationDetail(
  result: Record<string, unknown>,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(result).filter(
      ([key, value]) =>
        !/token|secret|credential|authorization/i.test(key) &&
        (value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"),
    ),
  ) as Prisma.InputJsonObject;
}

function resultNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function notificationNfeHref(job: IntegrationJob): string {
  const params = new URLSearchParams();
  if (typeof job.payload["from"] === "string")
    params.set("dataInicial", job.payload["from"]);
  if (typeof job.payload["to"] === "string")
    params.set("dataFinal", job.payload["to"]);
  return `/app/nfe${params.size ? `?${params}` : ""}`;
}

function jobLabel(jobType: IntegrationJob["jobType"]): string {
  const labels: Partial<Record<IntegrationJob["jobType"], string>> = {
    "bling.sync-daily-integrity": "Integridade diária do Bling",
    "bling.sync-nfe": "Sincronização de NF-e",
    "bling.sync-cancelled-nfe": "Atualização de cancelamentos",
    "bling.sync-products": "Sincronização de produtos",
    "bling.sync-sales-orders": "Sincronização de pedidos",
    "nfe.sync-details": "Atualização da NF-e",
    "nfe.process-xml": "Processamento fiscal da NF-e",
    "nfe.deliver": "Envio da NF-e",
    "apchat.deliver": "Envio APChat",
    "satisfaction.deliver": "Pesquisa de satisfação",
  };
  return labels[jobType] ?? "Integração";
}

function jobAction(jobType: IntegrationJob["jobType"]): string {
  if (jobType.startsWith("nfe.") || jobType === "bling.sync-nfe")
    return "/app/nfe";
  if (jobType === "bling.sync-products") return "/app/products";
  return "/app/operations";
}

function jobPermission(jobType: IntegrationJob["jobType"]): string {
  if (jobType.startsWith("nfe.") || jobType === "bling.sync-nfe")
    return "nfe:view";
  if (jobType === "bling.sync-products") return "products:view";
  return "operations:view";
}
