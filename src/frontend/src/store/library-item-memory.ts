import type { LibraryItem } from "@/types/library";

/** The store's memory of every title read (`libraryItems`), grown incrementally (`docs/32` section 3). It keeps a key to
 *  position index between calls, so adding a page costs the page's items plus one pointer copy of the array, not a
 *  rebuilt Map of everything read so far. The index is a derived cache: if the array it last produced was replaced from
 *  outside, it is rebuilt from the array it is given. */
export function createItemMemory(): (known: readonly LibraryItem[], items: readonly LibraryItem[]) => LibraryItem[] {
  const index = new Map<string, number>();
  let produced: readonly LibraryItem[] | null = null;
  const keyOf = (item: LibraryItem): string => `${item.ref.kind}:${item.ref.id}`;
  return (known, items) => {
    if (known !== produced) {
      index.clear();
      known.forEach((item, at) => index.set(keyOf(item), at));
    }
    const next = [...known];
    for (const item of items) {
      const key = keyOf(item);
      const at = index.get(key);
      if (at === undefined) {
        index.set(key, next.length);
        next.push(item);
      } else next[at] = item;
    }
    produced = next;
    return next;
  };
}
