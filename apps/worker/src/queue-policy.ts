import { createHash } from "node:crypto";
import type { JobsOptions } from "bullmq";

export const INTEGRATION_QUEUE = "integration-jobs";

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

export function buildIdempotentJobId(
  tenantId: string,
  jobType: string,
  stableBusinessKey: string,
): string {
  return createHash("sha256")
    .update(`${tenantId}\u0000${jobType}\u0000${stableBusinessKey}`)
    .digest("hex");
}
