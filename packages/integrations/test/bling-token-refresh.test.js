import { describe, expect, it, vi } from "vitest";
import { BlingTokenRefreshCoordinator, } from "../src/index.js";
class MemoryTokens {
    value;
    constructor(value) {
        this.value = value;
    }
    findByTenant() {
        return Promise.resolve(this.value === null ? null : { ...this.value });
    }
    save(record) {
        this.value = { ...record };
        return Promise.resolve();
    }
}
class SerialLock {
    #tail = Promise.resolve();
    runExclusive(_key, _ttlMs, operation) {
        void _key;
        void _ttlMs;
        const result = this.#tail.then(operation, operation);
        this.#tail = result.then(() => undefined, () => undefined);
        return result;
    }
}
const context = {
    tenantId: "tenant-a",
    correlationId: "correlation-a",
    demo: false,
};
const initial = {
    tenantId: "tenant-a",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAtEpochSeconds: 900,
    status: "S",
};
function coordinator(tokens, oauth) {
    const auditRecord = vi.fn(() => Promise.resolve());
    const audit = { record: auditRecord };
    return {
        auditRecord,
        service: new BlingTokenRefreshCoordinator({
            tokens,
            oauth,
            audit,
            lock: new SerialLock(),
            credentials: {
                getCredentials: () => Promise.resolve({ clientId: "client", clientSecret: "secret" }),
            },
            now: () => 1_000,
        }),
    };
}
describe("refresh distribuído do token Bling", () => {
    it("duas respostas 401 concorrentes renovam uma única vez", async () => {
        const tokens = new MemoryTokens(initial);
        const refresh = vi.fn(() => Promise.resolve({
            kind: "success",
            accessToken: "new-access",
            refreshToken: "new-refresh",
            expiresInSeconds: 3_600,
        }));
        const { service } = coordinator(tokens, { refresh });
        await expect(Promise.all([
            service.refreshIfNeeded(401, context),
            service.refreshIfNeeded(401, context),
        ])).resolves.toEqual([true, true]);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(tokens.value).toMatchObject({
            accessToken: "new-access",
            refreshToken: "new-refresh",
            status: "S",
            expiresAtEpochSeconds: 4_600,
        });
    });
    it("invalid_grant marca a integração como revogada", async () => {
        const tokens = new MemoryTokens(initial);
        const { service, auditRecord } = coordinator(tokens, {
            refresh: () => Promise.resolve({ kind: "invalid_grant" }),
        });
        await expect(service.refreshIfNeeded("expires", context)).resolves.toBe(false);
        expect(tokens.value?.status).toBe("N");
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ outcome: "revoked", code: "invalid_grant" }));
    });
    it("falha transitória restaura o estado disponível sem trocar tokens", async () => {
        const tokens = new MemoryTokens(initial);
        const { service } = coordinator(tokens, {
            refresh: () => Promise.resolve({ kind: "transient_failure", code: "http_503" }),
        });
        await expect(service.refreshIfNeeded(401, context)).resolves.toBe(false);
        expect(tokens.value).toEqual(initial);
    });
});
