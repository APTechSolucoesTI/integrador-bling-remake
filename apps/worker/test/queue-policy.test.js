import { buildIdempotentJobId, defaultJobOptions, } from "../src/queue-policy.js";
import { describe, expect, it } from "vitest";
describe("política de jobs", () => {
    it("gera a mesma chave para o mesmo evento de negócio", () => {
        const first = buildIdempotentJobId("tenant-a", "bling.sync-nfe", "2026-08");
        const second = buildIdempotentJobId("tenant-a", "bling.sync-nfe", "2026-08");
        expect(first).toBe(second);
    });
    it("isola a idempotência por tenant", () => {
        expect(buildIdempotentJobId("tenant-a", "sync", "42")).not.toBe(buildIdempotentJobId("tenant-b", "sync", "42"));
    });
    it("tem retry finito com backoff exponencial", () => {
        expect(defaultJobOptions).toMatchObject({
            attempts: 5,
            backoff: { type: "exponential", delay: 1_000 },
        });
    });
});
