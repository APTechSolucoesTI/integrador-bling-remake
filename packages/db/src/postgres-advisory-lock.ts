import { createHash } from "node:crypto";
import type { DistributedLock } from "@integrador/integrations";
import type { Pool, PoolClient } from "pg";

export class DistributedLockTimeoutError extends Error {
  constructor(key: string) {
    super(`Tempo esgotado ao adquirir lock distribuído: ${key}`);
    this.name = "DistributedLockTimeoutError";
  }
}

export class PostgresAdvisoryLock implements DistributedLock {
  constructor(private readonly pool: Pool) {}

  async runExclusive<T>(
    key: string,
    ttlMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    const [namespace, resource] = advisoryKey(key);
    const deadline = Date.now() + ttlMs;
    let acquired = false;

    try {
      while (!acquired && Date.now() < deadline) {
        acquired = await tryLock(client, namespace, resource);
        if (!acquired) await delay(50);
      }
      if (!acquired) throw new DistributedLockTimeoutError(key);
      return await operation();
    } finally {
      if (acquired) {
        await client.query("SELECT pg_advisory_unlock($1, $2)", [
          namespace,
          resource,
        ]);
      }
      client.release();
    }
  }
}

function advisoryKey(value: string): readonly [number, number] {
  const digest = createHash("sha256").update(value).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

async function tryLock(
  client: PoolClient,
  namespace: number,
  resource: number,
): Promise<boolean> {
  const result = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS acquired",
    [namespace, resource],
  );
  return result.rows[0]?.acquired === true;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
