import type { ItemRef, LibraryItem, MembershipSource } from "@/types/library";

/** The marks the app store holds (`store/app-store.ts`, `marks`): favourites and memberships, by item key. A key that is
 *  absent reads the fixture. */
export interface Marks {
  readonly favourites: Readonly<Partial<Record<string, boolean>>>;
  readonly memberships: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly membershipSources?: Readonly<Partial<Record<string, Readonly<Record<string, MembershipSource>>>>>;
}

/** Optimistic watch removals by watch-entry id. Item identity is insufficient because episodes have separate rows. */
export interface HistoryMarks {
  readonly removed: Readonly<Partial<Record<string, boolean>>>;
}

export const NO_HISTORY: HistoryMarks = { removed: {} };

/** An item as the Library shows it: its marks applied over the fixture. */
export interface ResolvedItem extends LibraryItem {
  readonly collectionIds: readonly string[];
  readonly collectionSources: Readonly<Record<string, MembershipSource>>;
}

/** The key of an item in the store's marks: `kind:id`. */
export function itemKey(ref: ItemRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function withRemoved(history: HistoryMarks, key: string): HistoryMarks {
  return { ...history, removed: { ...history.removed, [key]: true } };
}

export function withRestored(history: HistoryMarks, key: string): HistoryMarks {
  return { ...history, removed: { ...history.removed, [key]: false } };
}

export function withCleared(watchIds: readonly string[] = []): HistoryMarks {
  return { removed: Object.fromEntries(watchIds.map((watchId) => [watchId, true])) };
}

/** An item with shared marks applied. A removed watch id hides only that entry; a later entry remains visible. */
export function resolveItem(
  item: LibraryItem,
  marks: Marks,
  history: HistoryMarks,
  seed: Readonly<Partial<Record<string, readonly string[]>>>,
): ResolvedItem {
  const key = itemKey(item.ref);
  const gone = item.watchId !== undefined && history.removed[item.watchId] === true;
  return {
    ...item,
    favorite: marks.favourites[key] ?? item.favorite,
    progress: gone ? undefined : item.progress,
    collectionIds: marks.memberships[key] ?? seed[item.ref.id] ?? [],
    collectionSources: marks.membershipSources?.[key] ?? Object.fromEntries(
      (seed[item.ref.id] ?? []).map((collectionId) => [collectionId, "manual" as const]),
    ),
  };
}

export function resolveItems(
  items: readonly LibraryItem[],
  marks: Marks,
  history: HistoryMarks,
  seed: Readonly<Partial<Record<string, readonly string[]>>>,
): ResolvedItem[] {
  return items.map((item) => resolveItem(item, marks, history, seed));
}
