import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export type DatabaseClient = PrismaClient;

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: databasePoolSize(),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    }),
  });
}

function databasePoolSize(): number {
  const configured = Number.parseInt(
    process.env["DATABASE_POOL_MAX"] ?? "",
    10,
  );
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 10)
    : 2;
}
