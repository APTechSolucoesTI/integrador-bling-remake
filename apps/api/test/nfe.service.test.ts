import type { DatabaseClient } from "@integrador/db";
import { describe, expect, it, vi } from "vitest";
import type { AuthPrincipal } from "../src/auth/auth.types.js";
import { NfeService } from "../src/nfe/nfe.service.js";

const principal: AuthPrincipal = {
  sessionId: "00000000-0000-4000-8000-000000000004",
  userId: "00000000-0000-4000-8000-000000000002",
  userName: "Operador",
  userEmail: "operador@empresa.local",
  activeTenantId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Empresa teste",
  tenantSlug: "empresa-teste",
  tenantDemo: false,
  legacyUnitId: 77,
  role: "operator",
  expiresAt: new Date("2026-08-09T00:00:00.000Z"),
};

describe("NfeService", () => {
  it("sempre injeta a unidade da sessão nas consultas legadas", async () => {
    const queries: Array<{ strings: readonly string[]; values: unknown[] }> =
      [];
    const queryRaw = vi.fn(
      (query: { strings: readonly string[]; values: unknown[] }) => {
        queries.push(query);
        const sql = query.strings.join(" ");
        if (sql.includes("FROM nfe n")) return Promise.resolve([]);
        if (sql.includes("COUNT(*)::bigint AS total"))
          return Promise.resolve([{ total: 0n }]);
        return Promise.resolve([]);
      },
    );
    const service = new NfeService({
      $queryRaw: queryRaw,
    } as unknown as DatabaseClient);

    const result = await service.list(principal, {
      page: 1,
      pageSize: 50,
      numero: "9001",
      temCodigo: "S",
      order: "data_emissao",
      direction: "desc",
    });

    expect(result.pagination.total).toBe(0);
    expect(queries).toHaveLength(3);
    expect(queries.every((query) => query.values.includes(77))).toBe(true);
    expect(queries.some((query) => query.values.includes("9001"))).toBe(true);
  });

  it("não permite que um tenant marcado como demo alcance o PostgreSQL", async () => {
    const queryRaw = vi.fn();
    const service = new NfeService({
      $queryRaw: queryRaw,
    } as unknown as DatabaseClient);

    await expect(
      service.list(
        { ...principal, tenantDemo: true },
        {
          page: 1,
          pageSize: 50,
          order: "data_emissao",
          direction: "desc",
        },
      ),
    ).rejects.toThrow("demonstração pública");
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
