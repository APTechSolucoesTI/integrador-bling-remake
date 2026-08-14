import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPrismaClient, Prisma } from "@integrador/db";
import { ProductionIntegrationProcessor } from "./production.js";

loadEnvironmentFile();

const tenantId = requiredArgument("--tenant");
const databaseUrl = requiredEnvironment("DATABASE_URL");
const limit = parseLimit(optionalArgument("--limit") ?? "1");
const from = optionalArgument("--from") ?? isoDateDaysAgo(7);
const to = optionalArgument("--to") ?? isoDateDaysAgo(0);

if (!isUuid(tenantId)) throw new Error("--tenant deve ser um UUID válido");

const database = createPrismaClient(databaseUrl);

try {
  const tenant = await database.tenant.findUnique({
    where: { id: tenantId },
    select: { active: true, demo: true },
  });
  if (!tenant?.active || tenant.demo)
    throw new Error(
      "O tenant informado deve existir, estar ativo e não ser demo",
    );

  const processor = new ProductionIntegrationProcessor(database);
  const result = await processor.syncNfe(
    { tenantId, correlationId: randomUUID(), demo: false },
    {
      issuedFrom: from,
      issuedTo: to,
      maxPages: 1,
      pageSize: limit,
      maxRecords: limit,
    },
  );
  const invoices = await database.$queryRaw<
    Array<{ id: number; blingId: string; number: string }>
  >(Prisma.sql`
    SELECT id, id_bling::text AS "blingId", numero::text AS number
    FROM nfe
    WHERE unit_id = ${tenantId}
    ORDER BY updated_at DESC, id DESC
    LIMIT ${limit}
  `);
  console.info(
    JSON.stringify({
      event: "bling.smoke.completed",
      tenantId,
      range: { from, to },
      result,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        blingId: invoice.blingId,
        number: invoice.number,
      })),
    }),
  );
} finally {
  await database.$disconnect();
}

function requiredArgument(name: string): string {
  const value = optionalArgument(name);
  if (!value) throw new Error(`Parâmetro obrigatório ausente: ${name}`);
  return value;
}

function optionalArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada`);
  return value;
}

function parseLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5)
    throw new Error("--limit deve ser um inteiro entre 1 e 5");
  return parsed;
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function loadEnvironmentFile(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, name, value] = match;
    if (
      name !== undefined &&
      value !== undefined &&
      process.env[name] === undefined
    )
      process.env[name] = value;
  }
}
