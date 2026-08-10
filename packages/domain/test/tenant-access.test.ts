import {
  resolveAuthorizedTenant,
  TenantAccessDeniedError,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const session = {
  userId: "user-demo",
  activeTenantId: "tenant-a",
  allowedTenantIds: ["tenant-a"],
};

describe("isolamento de tenant", () => {
  it("usa o tenant autenticado quando o cliente não informa outro", () => {
    expect(resolveAuthorizedTenant(session)).toBe("tenant-a");
  });

  it("rejeita tenant de outra empresa mesmo se enviado pelo cliente", () => {
    expect(() => resolveAuthorizedTenant(session, "tenant-b")).toThrow(
      TenantAccessDeniedError,
    );
  });
});
