import type { LibraryItem } from "@/types/library";

/** The marks a person sets on the Library in phase 1: a favorite, a collection membership, a watch entry removed from
 *  History, and the cleared History. They are held in memory only; the library service replaces them. A favorite and a
 *  membership are seeded from the fixtures, so every item reads a value. */
export interface Marks {
  readonly favorite: Readonly<Partial<Record<string, boolean>>>;
  readonly collections: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly watchRemoved: Readonly<Partial<Record<string, boolean>>>;
  readonly historyCleared: boolean;
}

/** An item as the Library shows it: its marks applied over the fixture. */
export interface ResolvedItem extends LibraryItem {
  readonly collectionIds: readonly string[];
}

export function seedMarks(items: readonly LibraryItem[], memberships: Readonly<Record<string, readonly string[]>>): Marks {
  const favorite: Record<string, boolean> = {};
  for (const item of items) favorite[item.ref.id] = item.favorite;
  return { favorite, collections: { ...memberships }, watchRemoved: {}, historyCleared: false };
}

export function setFavorite(marks: Marks, itemId: string, value: boolean): Marks {
  return { ...marks, favorite: { ...marks.favorite, [itemId]: value } };
}

export function setMembership(marks: Marks, itemId: string, collectionId: string, member: boolean): Marks {
  const current = (marks.collections[itemId] ?? []).filter((id) => id !== collectionId);
  const next = member ? [...current, collectionId] : current;
  return { ...marks, collections: { ...marks.collections, [itemId]: next } };
}

export function removeWatch(marks: Marks, itemId: string): Marks {
  return { ...marks, watchRemoved: { ...marks.watchRemoved, [itemId]: true } };
}

export function clearHistory(marks: Marks): Marks {
  return { ...marks, historyCleared: true };
}

/** An item with the marks applied. A cleared History, or a removed watch entry, leaves the item without progress. */
export function resolveItem(item: LibraryItem, marks: Marks): ResolvedItem {
  const watchGone = marks.historyCleared || marks.watchRemoved[item.ref.id] === true;
  return {
    ...item,
    favorite: marks.favorite[item.ref.id] ?? item.favorite,
    progress: watchGone ? undefined : item.progress,
    collectionIds: marks.collections[item.ref.id] ?? [],
  };
}

export function resolveItems(items: readonly LibraryItem[], marks: Marks): ResolvedItem[] {
  return items.map((item) => resolveItem(item, marks));
}
