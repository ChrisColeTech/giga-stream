import { notConnected, type ServiceResult } from "./not-connected";

/** Cancels a queued or running job (`POST /api/jobs/:jobId/cancel`, `03` section 3.9). Phase 1 stub. */
export function cancelJob(_jobId: string): ServiceResult {
  return notConnected();
}
