import { randomUUID } from "node:crypto";
import { createPrismaClient } from "@integrador/db";
import { NfeXmlProcessor } from "./nfe-xml-processor.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const tenantId = argument("--tenant");
const execute = process.argv.includes("--execute");
const parsedLimit = Number.parseInt(argument("--limit") ?? "", 10);
const limit =
  Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
const databaseUrl = process.env["DATABASE_URL"];

if (!tenantId) throw new Error("Informe --tenant <UUID>");
if (!databaseUrl) throw new Error("DATABASE_URL não configurada");

const database = createPrismaClient(databaseUrl);

try {
  const tenant = await database.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, taxRegime: true, active: true, demo: true },
  });
  if (!tenant?.active || tenant.demo)
    throw new Error("Unidade produtiva não encontrada");

  const invoices = await database.invoice.findMany({
    where: { tenantId, statusCode: { not: 2 }, xmlUrl: { not: null } },
    select: { id: true, number: true, xmlUrl: true },
    orderBy: { id: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(
    JSON.stringify({
      tenant: tenant.name,
      taxRegime: tenant.taxRegime,
      eligibleInvoices: invoices.length,
      execute,
    }),
  );
  if (execute) {
    const processor = new NfeXmlProcessor(database);
    let processed = 0;
    const failures: Array<{ id: number; number: string; error: string }> = [];

    for (const invoice of invoices) {
      try {
        await processor.process({
          tenantId,
          unitId: tenantId,
          nfeId: invoice.id,
          xmlUrl: invoice.xmlUrl!,
          correlationId: randomUUID(),
        });
        processed += 1;
      } catch (cause) {
        failures.push({
          id: invoice.id,
          number: invoice.number,
          error: cause instanceof Error ? cause.message : "Erro desconhecido",
        });
      }
      if ((processed + failures.length) % 25 === 0)
        console.log(
          JSON.stringify({
            progress: processed + failures.length,
            processed,
            failed: failures.length,
          }),
        );
    }

    const totals = await database.invoice.aggregate({
      where: { tenantId, statusCode: { not: 2 } },
      _sum: {
        total: true,
        taxTotal: true,
        netCost: true,
        profit: true,
        ipiCredit: true,
        icmsCredit: true,
      },
    });
    console.log(
      JSON.stringify({
        processed,
        failed: failures.length,
        failures: failures.slice(0, 20),
        totals: totals._sum,
      }),
    );
    if (failures.length > 0) process.exitCode = 1;
  }
} finally {
  await database.$disconnect();
}
