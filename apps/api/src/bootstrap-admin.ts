import { createPrismaClient } from "@integrador/db";
import { hashPassword } from "@integrador/domain";

interface BootstrapConfiguration {
  email: string;
  password: string;
  userName: string;
  tenantName: string;
  tenantSlug: string;
  legacyUnitId: number | null;
  legacyUserId: number;
}

const databaseUrl = required("DATABASE_URL");
const configuration = readConfiguration();
const database = createPrismaClient(databaseUrl);

try {
  const passwordHash = await hashPassword(configuration.password);
  const result = await database.$transaction(async (transaction) => {
    const existingTenant = await transaction.tenant.findFirst({
      where: {
        OR: [
          { slug: configuration.tenantSlug },
          ...(configuration.legacyUnitId === null
            ? []
            : [{ legacyUnitId: configuration.legacyUnitId }]),
        ],
      },
    });
    const tenant = existingTenant
      ? await transaction.tenant.update({
          where: { id: existingTenant.id },
          data: {
            name: configuration.tenantName,
            slug: configuration.tenantSlug,
            legacyUnitId: configuration.legacyUnitId,
            active: true,
          },
        })
      : await transaction.tenant.create({
          data: {
            name: configuration.tenantName,
            slug: configuration.tenantSlug,
            legacyUnitId: configuration.legacyUnitId,
          },
        });

    const user = await transaction.user.upsert({
      where: { email: configuration.email },
      create: {
        email: configuration.email,
        name: configuration.userName,
        passwordHash,
        active: true,
        superAdmin: true,
      },
      update: {
        name: configuration.userName,
        passwordHash,
        active: true,
        superAdmin: true,
      },
    });

    const membership = await transaction.tenantMembership.findFirst({
      where: { tenantId: tenant.id, userId: user.id },
    });
    if (membership) {
      await transaction.tenantMembership.update({
        where: {
          tenantId_legacyUserId: {
            tenantId: tenant.id,
            legacyUserId: membership.legacyUserId,
          },
        },
        data: { role: "owner", active: true },
      });
    } else {
      await transaction.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          legacyUserId: configuration.legacyUserId,
          userId: user.id,
          role: "owner",
        },
      });
    }

    return { tenant: tenant.name, user: user.email };
  });

  console.info(
    JSON.stringify({
      level: "info",
      service: "bootstrap-admin",
      event: "bootstrap.completed",
      tenant: result.tenant,
      user: result.user,
    }),
  );
} finally {
  await database.$disconnect();
}

function readConfiguration(): BootstrapConfiguration {
  const email = required("APBLING_ADMIN_EMAIL").trim().toLowerCase();
  const password = required("APBLING_ADMIN_PASSWORD");
  if (password.length < 10)
    throw new Error("APBLING_ADMIN_PASSWORD deve ter ao menos 10 caracteres");
  const tenantSlug = required("APBLING_TENANT_SLUG").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug))
    throw new Error("APBLING_TENANT_SLUG inválido");
  return {
    email,
    password,
    userName: required("APBLING_ADMIN_NAME").trim(),
    tenantName: required("APBLING_TENANT_NAME").trim(),
    tenantSlug,
    legacyUnitId: optionalPositiveInteger("APBLING_LEGACY_UNIT_ID"),
    legacyUserId: optionalInteger("APBLING_LEGACY_USER_ID") ?? -1,
  };
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} é obrigatória`);
  return value;
}

function optionalPositiveInteger(key: string): number | null {
  const value = optionalInteger(key);
  if (value !== null && value <= 0)
    throw new Error(`${key} deve ser um inteiro positivo`);
  return value;
}

function optionalInteger(key: string): number | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${key} deve ser um inteiro`);
  return value;
}
