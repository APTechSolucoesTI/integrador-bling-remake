import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password.js";

describe("password", () => {
  it("gera salt por senha e valida sem expor o valor original", async () => {
    const first = await hashPassword("SenhaForte@2026");
    const second = await hashPassword("SenhaForte@2026");
    expect(first).not.toBe(second);
    expect(first).not.toContain("SenhaForte@2026");
    await expect(verifyPassword("SenhaForte@2026", first)).resolves.toBe(true);
    await expect(verifyPassword("senha-incorreta", first)).resolves.toBe(false);
  });
});
