import { MEMBER_MISSING } from "@/lib/collections-copy";
import type { ItemRef, LibraryItem } from "@/types/library";

/** One member row as the members table draws it. */
export interface MemberRow {
  readonly key: string;
  readonly title: string;
  readonly year: string;
}

/** Resolves a collection's manual members to their titles and years. A reference matches on both its kind and its id,
 *  so a title and a local file that share an id never match each other. A reference the library does not hold keeps its
 *  row, with the missing sentence, so the count of rows stays the count of members. */
export function memberRows(refs: readonly ItemRef[], items: readonly LibraryItem[]): MemberRow[] {
  return refs.map((ref) => {
    const item = items.find((candidate) => candidate.ref.kind === ref.kind && candidate.ref.id === ref.id);
    return {
      key: `${ref.kind}:${ref.id}`,
      title: item?.title ?? MEMBER_MISSING,
      year: item?.year === undefined ? "" : String(item.year),
    };
  });
}
