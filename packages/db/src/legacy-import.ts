import { createHash } from "node:crypto";
import { Pool } from "pg";
import { createPrismaClient } from "./client.js";
import type { Prisma } from "./generated/prisma/client.js";

const STAGES = [
  ["tenants", ["system_unit"]],
  ["users", ["system_users", "system_user_unit"]],
  ["settings", ["preferencia_geral", "crontab_config", "pesquisa_satisfacao"]],
  [
    "commercial",
    [
      "setor",
      "vendedores",
      "canal_venda",
      "forma_pagamento",
      "natureza_operacao",
    ],
  ],
  ["contacts", ["pessoa", "pessoa_endereco"]],
  ["products", ["grupo_produto", "produtos"]],
  [
    "fiscal",
    [
      "tipo_custo_fixo",
      "custo_fixo",
      "cfcv",
      "tributacao",
      "tributacao_difal",
      "credito_ncm",
      "taxa_parcelamento",
    ],
  ],
  ["sales", ["pedido_venda"]],
  [
    "invoices",
    [
      "nfe",
      "nfe_item",
      "tributacao_item",
      "custo_item",
      "taxa_item",
      "credito_item",
    ],
  ],
  ["documents", ["boleto"]],
  ["goals", ["meta", "meta_vendedores", "meta_setor", "meta_custo"]],
] as const;

const databaseUrl = required("DATABASE_URL");
const legacyDatabaseUrl = required("LEGACY_DATABASE_URL");
if (sameDatabase(databaseUrl, legacyDatabaseUrl))
  throw new Error(
    "DATABASE_URL e LEGACY_DATABASE_URL não podem apontar para o mesmo banco",
  );

const execute = process.argv.includes("--execute");
const source = new Pool({ connectionString: legacyDatabaseUrl, max: 2 });
const target = createPrismaClient(databaseUrl);

try {
  await source.query("SET default_transaction_read_only = on");
  const fingerprint = createHash("sha256")
    .update(safeDatabaseIdentity(legacyDatabaseUrl))
    .digest("hex");
  const run = await target.legacyImportRun.create({
    data: {
      status: "running",
      sourceFingerprint: fingerprint,
      startedAt: new Date(),
      statistics: { mode: execute ? "execute" : "plan" },
    },
  });

  try {
    const checkpoints: Record<string, unknown> = {};
    for (const [stage, tables] of STAGES) {
      const counts: Record<string, number | null> = {};
      for (const table of tables) counts[table] = await tableCount(table);
      checkpoints[stage] = { status: "discovered", tables: counts };
      await target.legacyImportRun.update({
        where: { id: run.id },
        data: { checkpoints: checkpoints as Prisma.InputJsonValue },
      });
    }

    if (execute) {
      await importTenants();
      checkpoints["tenants"] = {
        ...(checkpoints["tenants"] as object),
        status: "imported",
      };
      checkpoints["remaining"] = {
        status: "planned",
        reason: "Transformadores serão habilitados por estágio no cutover",
      };
    }

    await target.legacyImportRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        checkpoints: checkpoints as Prisma.InputJsonValue,
        statistics: {
          mode: execute ? "execute-tenants" : "plan",
          stages: STAGES.length,
        },
      },
    });
    console.info(
      JSON.stringify({
        event: "legacy.import.completed",
        runId: run.id,
        mode: execute ? "execute-tenants" : "plan",
      }),
    );
  } catch (error) {
    await target.legacyImportRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Erro desconhecido",
      },
    });
    throw error;
  }
} finally {
  await Promise.all([source.end(), target.$disconnect()]);
}

async function tableCount(table: string): Promise<number | null> {
  const exists = await source.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${table}`],
  );
  if (!exists.rows[0]?.exists) return null;
  const result = await source.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function importTenants(): Promise<void> {
  const result = await source.query<{
    id: number;
    name: string;
    regime_tributario: string | null;
  }>("SELECT id, name, regime_tributario FROM system_unit ORDER BY id");
  for (const legacy of result.rows) {
    const slug = `${slugify(legacy.name) || "empresa"}-${legacy.id}`;
    const tenant = await target.tenant.upsert({
      where: { legacyUnitId: legacy.id },
      create: {
        legacyUnitId: legacy.id,
        name: legacy.name,
        slug,
        taxRegime: legacy.regime_tributario,
      },
      update: {
        name: legacy.name,
        taxRegime: legacy.regime_tributario,
      },
    });
    await target.legacyEntityMapping.upsert({
      where: {
        tenantId_entityType_legacyId: {
          tenantId: tenant.id,
          entityType: "tenant",
          legacyId: String(legacy.id),
        },
      },
      create: {
        tenantId: tenant.id,
        entityType: "tenant",
        legacyId: String(legacy.id),
        modernId: tenant.id,
      },
      update: { modernId: tenant.id },
    });
  }
}

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} não configurada`);
  return value;
}

function sameDatabase(first: string, second: string): boolean {
  return safeDatabaseIdentity(first) === safeDatabaseIdentity(second);
}

function safeDatabaseIdentity(value: string): string {
  const url = new URL(value);
  return `${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`;
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value))
    throw new Error("Identificador SQL inválido");
  return `"${value}"`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
