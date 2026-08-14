import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://integrador_bling:asdlkjI9DDFJ9sjk9dh56h6jh@192.168.3.106:5433/integrador_bling_v2?schema=public",
  },
});
