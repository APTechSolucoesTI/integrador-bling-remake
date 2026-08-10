import { createHash } from "node:crypto";
export class DistributedLockTimeoutError extends Error {
    constructor(key) {
        super(`Tempo esgotado ao adquirir lock distribuído: ${key}`);
        this.name = "DistributedLockTimeoutError";
    }
}
export class PostgresAdvisoryLock {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async runExclusive(key, ttlMs, operation) {
        const client = await this.pool.connect();
        const [namespace, resource] = advisoryKey(key);
        const deadline = Date.now() + ttlMs;
        let acquired = false;
        try {
            while (!acquired && Date.now() < deadline) {
                acquired = await tryLock(client, namespace, resource);
                if (!acquired)
                    await delay(50);
            }
            if (!acquired)
                throw new DistributedLockTimeoutError(key);
            return await operation();
        }
        finally {
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
function advisoryKey(value) {
    const digest = createHash("sha256").update(value).digest();
    return [digest.readInt32BE(0), digest.readInt32BE(4)];
}
async function tryLock(client, namespace, resource) {
    const result = await client.query("SELECT pg_try_advisory_lock($1, $2) AS acquired", [namespace, resource]);
    return result.rows[0]?.acquired === true;
}
function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
