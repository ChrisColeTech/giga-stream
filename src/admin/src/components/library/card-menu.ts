import { collectionsSubmenu } from "@/lib/collection-menu";
import { watchLine } from "@/lib/library-facts";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { openMenu } from "@/lib/menu";
import type { CollectionRow } from "@/types/collection";
import type { MenuItem } from "@giga/ui/menus/types";
import { changeFavourite, changeMembership, playRef } from "./library-service";

/** What openMenu reads from a pointer event: the anchor, and the two calls that keep a parent's handler out of it. */
export type MenuEvent = Parameters<typeof openMenu>[0];

const noop = (): void => undefined;

/** A menu anchored under an element, for a control that has no pointer event of its own. */
export function menuEventBelow(element: HTMLElement): MenuEvent {
  const box = element.getBoundingClientRect();
  return { clientX: box.left, clientY: box.bottom, preventDefault: noop, stopPropagation: noop };
}

/** The `Collections ▸` row of one item: a check for each membership, and a click toggles it. */
export function membershipRow(item: ResolvedItem, collections: readonly CollectionRow[]): MenuItem {
  const isMember = (id: string): boolean => item.collectionIds.includes(id);
  return collectionsSubmenu(collections, isMember, (id) =>
    changeMembership(item.ref, id, !isMember(id), item.collectionIds),
  );
}

/** A menu of only the Collections submenu, opened from Title information's Collections button. */
export function openMembershipMenu(event: MenuEvent, item: ResolvedItem, collections: readonly CollectionRow[]): void {
  openMenu(event, [membershipRow(item, collections)]);
}

export interface CardMenuContext {
  readonly collections: readonly CollectionRow[];
  readonly inHistory: boolean;
  readonly onInfo: () => void;
  readonly onRemoveWatch: () => void;
}

/** A card's context menu: Play or Open, Info, Favorite, Collections, and in History the removal of the watch entry. */
export function openCardMenu(event: MenuEvent, item: ResolvedItem, context: CardMenuContext): void {
  openMenu(event, [
    item.progress !== undefined && { kind: "heading", label: watchLine(item.progress) },
    { kind: "action", label: item.kind === "tv" ? "Open" : "Play", onSelect: () => playRef(item.ref) },
    { kind: "action", label: "Info", onSelect: context.onInfo },
    {
      kind: "action",
      label: item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite,
      onSelect: () => changeFavourite(item.ref, !item.favorite),
    },
    { kind: "separator" },
    membershipRow(item, context.collections),
    context.inHistory && {
      kind: "action",
      label: LIBRARY_COPY.removeWatch,
      disabled: item.watchId === undefined,
      disabledReason: LIBRARY_COPY.noWatchEntry,
      onSelect: context.onRemoveWatch,
    },
  ]);
}
