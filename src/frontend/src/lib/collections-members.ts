import { MEMBER_MISSING } from "@/lib/collections-copy";
import type { ItemRef, LibraryItem, MembershipSource } from "@/types/library";

/** One member row as the members table draws it, and what its remove control names. */
export interface MemberRow {
  readonly key: string;
  readonly ref: ItemRef;
  readonly title: string;
  readonly year: string;
  readonly poster: string | undefined;
  readonly source: MembershipSource;
}

/** Resolves collection-view items to table rows, preserving whether each one is manual or folder-derived. */
export function memberRows(refs: readonly ItemRef[], items: readonly LibraryItem[]): MemberRow[] {
  return refs.map((ref) => {
    const item = items.find((candidate) => candidate.ref.kind === ref.kind && candidate.ref.id === ref.id);
    return {
      key: `${ref.kind}:${ref.id}`,
      ref,
      title: item?.title ?? MEMBER_MISSING,
      year: item?.year === undefined ? "" : String(item.year),
      poster: item?.posterUrl,
      source: item?.collectionSource ?? "manual",
    };
  });
}
