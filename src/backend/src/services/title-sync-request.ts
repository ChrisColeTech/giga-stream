import type { SyncRequest } from "./title-shapes.js";

/** What the audit trail records of a sync request: its scope and size. */
export function describeRequest(request: SyncRequest): Record<string, unknown> {
  return { scope: request.scope, kind: request.kind, pages: request.pages };
}
