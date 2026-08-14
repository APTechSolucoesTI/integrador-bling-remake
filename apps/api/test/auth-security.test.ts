import { ForbiddenException } from "@nestjs/common";
import type { DatabaseClient } from "@integrador/db";
import { describe, expect, it, vi } from "vitest";
import { AuthService, tokenHash } from "../src/auth/auth.service.js";
import type { AuthPrincipal } from "../src/auth/auth.types.js";

const principal: AuthPrincipal = {
  sessionId: "00000000-0000-4000-8000-000000000010",
  userId: "00000000-0000-4000-8000-000000000011",
  userName: "Operador",
  userEmail: "operador@example.test",
  activeTenantId: "00000000-0000-4000-8000-000000000012",
  tenantName: "Tenant A",
  tenantSlug: "tenant-a",
  tenantDemo: false,
  legacyUnitId: 1,
  superAdmin: false,
  masterKeyAccess: false,
  permissions: [],
  expiresAt: new Date("2026-08-08T18:00:00Z"),
};

describe("segurança de autenticação", () => {
  it("persiste um hash estável sem guardar o token de sessão", () => {
    const token = "token-opaco-que-vai-somente-para-o-cookie";
    expect(tokenHash(token)).toHaveLength(64);
    expect(tokenHash(token)).toBe(tokenHash(token));
    expect(tokenHash(token)).not.toContain(token);
  });

  it("nega troca para tenant sem membership ativa", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const database = {
      tenantMembership: { findFirst },
    } as unknown as DatabaseClient;
    const service = new AuthService(database);
    const requestedTenant = "00000000-0000-4000-8000-000000000099";

    await expect(
      service.switchTenant(principal, requestedTenant),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: principal.userId,
        tenantId: requestedTenant,
        active: true,
        tenant: { active: true },
      },
    });
  });
});
