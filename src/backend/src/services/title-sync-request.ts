import type { SyncRequest } from "./title-shapes.js";

/** What the audit trail records of a sync request: its scope and size, never the ids themselves. */
export function describeRequest(request: SyncRequest): Record<string, unknown> {
  return request.scope === "titles"
    ? { scope: "titles", ids: (request.ids ?? []).length }
    : { scope: request.scope, kind: request.kind, pages: request.pages };
}
