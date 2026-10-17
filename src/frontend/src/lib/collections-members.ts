import { MEMBER_MISSING } from "@/lib/collections-copy";
import type { ItemRef, LibraryItem } from "@/types/library";

/** One member row as the members table draws it, and what its remove control names. */
export interface MemberRow {
  readonly key: string;
  readonly ref: ItemRef;
  readonly title: string;
  readonly year: string;
  readonly poster: string | undefined;
}

/** Resolves a collection's manual members to their titles, years and posters. A reference matches on both its kind and its
 *  id, so a title and a local file that share an id never match each other. A reference the library does not hold keeps
 *  its row, with the missing sentence, so the count of rows stays the count of members. */
export function memberRows(refs: readonly ItemRef[], items: readonly LibraryItem[]): MemberRow[] {
  return refs.map((ref) => {
    const item = items.find((candidate) => candidate.ref.kind === ref.kind && candidate.ref.id === ref.id);
    return {
      key: `${ref.kind}:${ref.id}`,
      ref,
      title: item?.title ?? MEMBER_MISSING,
      year: item?.year === undefined ? "" : String(item.year),
      poster: item?.posterUrl,
    };
  });
}
