import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  DistributedLockTimeoutError,
  PostgresAdvisoryLock,
} from "../src/postgres-advisory-lock.js";

function poolReturning(acquired: boolean) {
  const query = vi.fn((statement: string) =>
    Promise.resolve({
      rows: statement.includes("pg_try_advisory_lock")
        ? [{ acquired }]
        : [{ pg_advisory_unlock: true }],
    }),
  );
  const release = vi.fn();
  const pool = {
    connect: () => Promise.resolve({ query, release }),
  } as unknown as Pool;
  return { pool, query, release };
}

describe("PostgresAdvisoryLock", () => {
  it("libera o mesmo advisory lock depois da operação", async () => {
    const { pool, query, release } = poolReturning(true);
    const lock = new PostgresAdvisoryLock(pool);

    await expect(
      lock.runExclusive("bling:refresh:tenant-a", 100, () =>
        Promise.resolve("ok"),
      ),
    ).resolves.toBe("ok");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("pg_advisory_unlock");
    expect(release).toHaveBeenCalledOnce();
  });

  it("encerra a espera e libera a conexão quando não adquire", async () => {
    const { pool, release } = poolReturning(false);
    const lock = new PostgresAdvisoryLock(pool);

    await expect(
      lock.runExclusive("busy", 1, () => Promise.resolve("never")),
    ).rejects.toBeInstanceOf(DistributedLockTimeoutError);
    expect(release).toHaveBeenCalledOnce();
  });
});
