import { createHash } from "node:crypto";
import {
  integrationJobSchema,
  type IntegrationJob,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import type { Queue } from "bullmq";

interface ScheduleRow {
  tenantId: string;
  unitId: string;
  hours: number[];
  satisfactionEnabled: boolean;
  satisfactionHour: number | null;
}

interface ClockParts {
  date: string;
  hour: number;
  yesterday: string;
  weekAgo: string;
}

export class OperationalScheduler {
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(
    private readonly database: DatabaseClient,
    private readonly queue: Queue,
  ) {}

  start(): void {
    if (this.#timer) return;
    void this.tick();
    this.#timer = setInterval(() => void this.tick(), 60_000);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  async tick(now = new Date()): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      const clock = saoPauloClock(now);
      const schedules = await this.database.$queryRaw<ScheduleRow[]>(Prisma.sql`
        SELECT
          tenant.id::text AS "tenantId",
          tenant.id::text AS "unitId",
          config.hours,
          COALESCE(satisfaction.habilitar, FALSE) AS "satisfactionEnabled",
          satisfaction.tempo_hora_env AS "satisfactionHour"
        FROM saas_tenant tenant
        JOIN operational_schedule config
          ON config.tenant_id = tenant.id
         AND config.job_type = 'bling.sync-nfe'
         AND config.enabled = TRUE
        LEFT JOIN LATERAL (
          SELECT habilitar, tempo_hora_env
          FROM pesquisa_satisfacao
          WHERE unit_id = tenant.id
          ORDER BY id
          LIMIT 1
        ) satisfaction ON TRUE
        WHERE tenant.active = TRUE
          AND tenant.demo = FALSE
      `);

      for (const schedule of schedules) {
        if (schedule.hours.includes(clock.hour)) {
          await this.enqueue(
            schedule.tenantId,
            "bling.sync-nfe",
            `${clock.date}-${clock.hour}`,
            {
              from: clock.yesterday,
              to: clock.date,
              autoDeliver: true,
            },
          );
        }
        if (clock.hour === 0) {
          for (const jobType of [
            "bling.sync-payment-methods",
            "bling.sync-sales-channels",
            "bling.sync-sellers",
            "bling.sync-operation-natures",
          ] as const) {
            await this.enqueue(schedule.tenantId, jobType, clock.date, {});
          }
          await this.enqueue(
            schedule.tenantId,
            "goals.process-expired",
            clock.date,
            {},
          );
          await this.enqueue(
            schedule.tenantId,
            "bling.sync-cancelled-nfe",
            clock.date,
            { from: clock.weekAgo, to: clock.date },
          );
        }
        if (clock.hour === 17) {
          await this.enqueue(
            schedule.tenantId,
            "bling.sync-products",
            clock.date,
            {},
          );
          await this.enqueue(
            schedule.tenantId,
            "bling.sync-sales-orders",
            clock.date,
            { from: clock.yesterday, to: clock.date },
          );
        }
        if (
          schedule.satisfactionEnabled &&
          schedule.satisfactionHour === clock.hour
        ) {
          await this.enqueue(
            schedule.tenantId,
            "satisfaction.deliver",
            clock.date,
            {},
          );
        }
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "worker",
          event: "scheduler.failed",
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Falha desconhecida",
        }),
      );
    } finally {
      this.#running = false;
    }
  }

  private async enqueue(
    tenantId: string,
    jobType: IntegrationJob["jobType"],
    businessKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const id = deterministicUuid(`${tenantId}:${jobType}:${businessKey}`);
    const correlationId = deterministicUuid(
      `${tenantId}:${jobType}:${businessKey}:correlation`,
    );
    try {
      await this.database.jobExecution.create({
        data: {
          id,
          tenantId,
          jobType,
          status: "queued",
          correlationId,
        },
      });
    } catch (error) {
      if (isUniqueConstraint(error)) return;
      throw error;
    }

    const job = integrationJobSchema.parse({
      tenantId,
      jobType,
      correlationId,
      payload,
      createdAt: new Date().toISOString(),
    });
    try {
      await this.queue.add(jobType, job, { jobId: id });
      await this.database.auditLog.create({
        data: {
          tenantId,
          actorUserId: null,
          action: "operations.job.scheduled",
          entityType: "job_execution",
          entityId: id,
          correlationId,
          metadata: { jobType, businessKey },
        },
      });
    } catch (error) {
      await this.database.jobExecution.update({
        where: { id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorCode: "queue_unavailable",
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Queue unavailable",
        },
      });
      throw error;
    }
  }
}

function saoPauloClock(value: Date): ClockParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const previous = new Date(`${date}T12:00:00-03:00`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const yesterday = formatter.format(previous);
  const week = new Date(`${date}T12:00:00-03:00`);
  week.setUTCDate(week.getUTCDate() - 7);
  return {
    date,
    hour: Number(get("hour")),
    yesterday,
    weekAgo: formatter.format(week),
  };
}

function deterministicUuid(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
