import { Queue, QueueEvents, Worker } from "bullmq";
import { runtimeEnvSchema } from "@integrador/contracts";
import { createPrismaClient } from "@integrador/db";
import { ApChatFakeGateway, BlingFakeGateway } from "@integrador/integrations";
import { createIntegrationProcessor } from "./processor.js";
import { ProductionIntegrationProcessor } from "./production.js";
import { defaultJobOptions, INTEGRATION_QUEUE } from "./queue-policy.js";

const env = runtimeEnvSchema.parse(process.env);
const database = createPrismaClient(env.DATABASE_URL);
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
const worker = new Worker(
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
        await database.jobExecution.updateMany({
          where: { id: executionId, tenantId: job.data.tenantId },
          data: { status: "completed", finishedAt: new Date() },
        });
      }
      return result;
    } catch (error) {
      if (executionId) {
        const willRetry = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
        await database.jobExecution.updateMany({
          where: { id: executionId, tenantId: job.data.tenantId },
          data: {
            status: willRetry ? "queued" : "failed",
            finishedAt: willRetry ? null : new Date(),
            errorCode:
              error instanceof Error ? error.name : "UnknownWorkerError",
            errorMessage:
              error instanceof Error
                ? error.message.slice(0, 500)
                : "Falha desconhecida",
          },
        });
      }
      throw error;
    }
  },
  {
    connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
    concurrency: 5,
    limiter: { max: 3, duration: 1_000 },
    lockDuration: 60_000,
  },
);

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

const shutdown = async (): Promise<void> => {
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
