import { createHash } from "node:crypto";
export const INTEGRATION_QUEUE = "integration-jobs";
export const defaultJobOptions = {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 5_000 },
};
export function buildIdempotentJobId(tenantId, jobType, stableBusinessKey) {
    return createHash("sha256")
        .update(`${tenantId}\u0000${jobType}\u0000${stableBusinessKey}`)
        .digest("hex");
}
