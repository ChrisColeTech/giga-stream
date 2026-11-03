import { AppError, ERRORS } from "./errors.js";

export const EXTERNAL_EXECUTION_REASON =
  "Sync execution is disabled on this API. Run and monitor catalog jobs in Cloud Run Jobs.";

export function requireSyncExecution(reason?: string): void {
  if (reason !== undefined) throw new AppError(ERRORS.jobDisabled, { reason }, reason);
}
