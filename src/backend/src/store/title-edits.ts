/** The payload fields an admin may edit on a title (docs/26 section 4.9b); the names `edited_fields` records. */
export const EDITABLE_TITLE_FIELDS = [
  "title", "year", "genres", "rating", "posterUrl", "backdropUrl", "plot", "cast", "runtimeMs", "seasons", "streamUrl",
] as const;
export type EditableTitleField = (typeof EDITABLE_TITLE_FIELDS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Copies `fields` from `source` onto `payload` (a field `source` lacks is removed from `payload`), and onto the
 * `listSnapshot` a detail payload keeps of its thin list row, so a browse list shows the same edit. This is the one
 * rule by which an admin's edit outranks TMDB: the store applies it on every write of a synced title, and the
 * reads apply it to a row TMDB has just answered. Returns a new object; neither argument is changed.
 */
export function applyFields(payload: unknown, source: unknown, fields: readonly string[]): Record<string, unknown> {
  const target: Record<string, unknown> = isRecord(payload) ? { ...payload } : {};
  const from = isRecord(source) ? source : {};
  const set = (row: Record<string, unknown>): void => {
    for (const field of fields) {
      if (from[field] === undefined) delete row[field];
      else row[field] = from[field];
    }
  };
  set(target);
  if (isRecord(target.listSnapshot)) {
    const snapshot = { ...target.listSnapshot };
    set(snapshot);
    target.listSnapshot = snapshot;
  }
  return target;
}
