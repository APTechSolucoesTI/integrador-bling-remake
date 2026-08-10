import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://integrador:integrador@localhost:5432/integrador_bling",
  },
});
