import type { SyncRequest } from "./title-shapes.js";

/** What the audit trail records of a sync request: its scope and size; the Library fill is the sliced walk (docs/48). */
export function describeRequest(request: SyncRequest): Record<string, unknown> {
  if (request.scope === "discover") return { scope: "discover", walk: "by year, both kinds, to the last page" };
  if (request.scope === "recent") {
    const walk = "recent discover, then TMDB changes, then a refresh";
    return { scope: "recent", walk, ...(request.since !== undefined && { since: request.since }) };
  }
  return { scope: request.scope, kind: request.kind, pages: request.pages };
}
