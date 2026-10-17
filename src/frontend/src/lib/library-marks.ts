import type { ItemRef, LibraryItem } from "@/types/library";

/** The marks the app store holds (`store/app-store.ts`, `marks`): favourites and memberships, by item key. A key that is
 *  absent reads the fixture. */
export interface Marks {
  readonly favourites: Readonly<Partial<Record<string, boolean>>>;
  readonly memberships: Readonly<Partial<Record<string, readonly string[]>>>;
}

/** Watch-history marks the Library keeps in its own state: a removed entry, and a cleared History. The store has no
 *  field for them yet, so Title information does not see them. */
export interface HistoryMarks {
  readonly cleared: boolean;
  readonly removed: Readonly<Partial<Record<string, boolean>>>;
}

export const NO_HISTORY: HistoryMarks = { cleared: false, removed: {} };

/** An item as the Library shows it: its marks applied over the fixture. */
export interface ResolvedItem extends LibraryItem {
  readonly collectionIds: readonly string[];
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

export function withCleared(): HistoryMarks {
  return { cleared: true, removed: {} };
}

/** An item with the marks applied. A cleared History, or a removed entry, leaves the item without progress. `seed` holds
 *  the fixture memberships, read until the store has one for the item. */
export function resolveItem(
  item: LibraryItem,
  marks: Marks,
  history: HistoryMarks,
  seed: Readonly<Partial<Record<string, readonly string[]>>>,
): ResolvedItem {
  const key = itemKey(item.ref);
  const gone = history.cleared || history.removed[key] === true;
  return {
    ...item,
    favorite: marks.favourites[key] ?? item.favorite,
    progress: gone ? undefined : item.progress,
    collectionIds: marks.memberships[key] ?? seed[item.ref.id] ?? [],
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
