import {
  dashboardSummarySchema,
  integrationJobSchema,
  loginRequestSchema,
  nfeListQuerySchema,
  tenantSessionSchema,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const tenantId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

describe("contratos compartilhados", () => {
  it("rejeita sessão sem tenant permitido", () => {
    expect(
      tenantSessionSchema.safeParse({
        userId,
        activeTenantId: tenantId,
        allowedTenantIds: [],
        roles: ["operator"],
        demo: true,
      }).success,
    ).toBe(false);
  });

  it("valida envelope observável de job", () => {
    expect(
      integrationJobSchema.safeParse({
        tenantId,
        jobType: "bling.sync-nfe",
        correlationId: "00000000-0000-4000-8000-000000000003",
        payload: { from: "2026-08-01", to: "2026-08-07" },
        createdAt: "2026-08-07T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("normaliza o e-mail sem aceitar senha curta", () => {
    expect(
      loginRequestSchema.parse({
        email: "  Demo@Integrador.Local ",
        password: "SenhaForte@2026",
      }).email,
    ).toBe("demo@integrador.local");
    expect(
      loginRequestSchema.safeParse({
        email: "demo@integrador.local",
        password: "curta",
      }).success,
    ).toBe(false);
  });

  it("rejeita dinheiro serializado sem escala explícita", () => {
    expect(
      dashboardSummarySchema.safeParse({
        source: "legacy-postgresql",
        tenant: { id: tenantId, name: "Empresa teste", demo: false },
        period: {
          from: "2026-08-01T00:00:00.000Z",
          to: "2026-09-01T00:00:00.000Z",
          months: 1,
        },
        metrics: {
          grossRevenue: "100",
          netRevenue: "90.00",
          cost: "50.00",
          tax: "10.00",
          profit: "30.00",
          marginPercent: "30.00",
          invoiceCount: 1,
        },
        months: [],
        recentInvoices: [],
      }).success,
    ).toBe(false);
  });

  it("normaliza filtros da listagem de NF-e e preserva o limite legado", () => {
    const query = nfeListQuerySchema.parse({
      page: "2",
      pageSize: "50",
      valor: "159,90",
      temCodigo: "S",
      dataInicial: "2026-08-01",
      dataFinal: "2026-08-08",
    });
    expect(query).toMatchObject({
      page: 2,
      pageSize: 50,
      valor: "159.90",
      temCodigo: "S",
    });
    expect(nfeListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
