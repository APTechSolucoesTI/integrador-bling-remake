import { createPrismaClient } from "../src/client.js";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL não configurada");

const database = createPrismaClient(databaseUrl);
const demoTenantId =
  process.env["DEMO_TENANT_ID"] ?? "00000000-0000-4000-8000-000000000001";

try {
  const tenant = await database.tenant.upsert({
    where: { id: demoTenantId },
    create: {
      id: demoTenantId,
      name: "APBling Demonstração",
      slug: "demo",
      brandName: "APBling",
      taxRegime: "LP",
      demo: true,
      active: true,
    },
    update: {
      name: "APBling Demonstração",
      brandName: "APBling",
      taxRegime: "LP",
      demo: true,
      active: true,
    },
  });

  for (const name of ["Custo", "Imposto", "Taxa", "Crédito"]) {
    await database.fixedCostCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      create: { tenantId: tenant.id, name },
      update: {},
    });
  }

  for (const rule of [
    { name: "ICMS", rate: "18" },
    { name: "IPI", rate: "0" },
    { name: "PIS", rate: "0.65" },
    { name: "COFINS", rate: "3" },
    { name: "IBS", rate: "0" },
    { name: "CBS", rate: "0" },
  ]) {
    await database.taxRule.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: rule.name } },
      create: {
        tenantId: tenant.id,
        name: rule.name,
        simulationRate: rule.rate,
      },
      update: {},
    });
  }

  const stateRates: Record<string, string> = {
    AC: "19",
    AL: "19",
    AP: "18",
    AM: "20",
    BA: "20.5",
    CE: "20",
    DF: "20",
    ES: "17",
    GO: "19",
    MA: "23",
    MT: "17",
    MS: "17",
    MG: "18",
    PA: "19",
    PB: "20",
    PR: "19.5",
    PE: "20.5",
    PI: "21",
    RJ: "22",
    RN: "20",
    RS: "17",
    RO: "19.5",
    RR: "20",
    SC: "17",
    SP: "18",
    SE: "19",
    TO: "20",
  };
  for (const [state, internalRate] of Object.entries(stateRates)) {
    await database.difalRule.upsert({
      where: { tenantId_state: { tenantId: tenant.id, state } },
      create: { tenantId: tenant.id, state, internalRate },
      update: {},
    });
  }

  await database.satisfactionConfig.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      enabled: false,
      delayDays: 7,
      delayHours: 10,
      message:
        "Olá {cliente}, conte como foi sua experiência com {empresa}: {pesquisa}",
    },
    update: {},
  });

  await database.operationalSchedule.upsert({
    where: {
      tenantId_jobType: { tenantId: tenant.id, jobType: "bling.sync-nfe" },
    },
    create: {
      tenantId: tenant.id,
      jobType: "bling.sync-nfe",
      name: "Sincronização automática de NF-e",
      enabled: false,
      hours: [],
    },
    update: {},
  });

  console.info(
    JSON.stringify({ event: "database.seed.completed", tenantId: tenant.id }),
  );
} finally {
  await database.$disconnect();
}
