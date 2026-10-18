import type { StoredTitle } from "../store/title-repository.js";
import { asRecord } from "./title-shapes.js";

export type TitleState = "synced" | "edited" | "manual";

export const stateOf = (row: StoredTitle): TitleState =>
  row.origin === "manual" ? "manual" : row.editedFields.length > 0 ? "edited" : "synced";

/**
 * A stored record as the routes answer it: its payload without the list snapshot, and its `state`. `enabled` is an
 * admin's field: it is on the admin's answers and never on a public read.
 */
export function viewOf(row: StoredTitle, withEnabled = true): Record<string, unknown> {
  const { listSnapshot: _snapshot, ...payload } = asRecord(row.payload);
  return {
    ...payload,
    id: row.id,
    kind: row.kind,
    state: stateOf(row),
    ...(withEnabled && { enabled: row.enabled, editedFields: row.editedFields }),
  };
}
