import { collectionsSubmenu } from "@/lib/collection-menu";
import { watchLine } from "@/lib/library-facts";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { openMenu } from "@/lib/menu";
import type { CollectionRow } from "@/types/collection";
import type { MenuItem } from "@giga/ui/menus/types";
import type { MembershipSource } from "@/types/library";
import { useAppStore } from "@/store/app-store";
import { changeFavourite, changeMembership, loadMemberships, playRef } from "./library-service";

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
  const source = (id: string): MembershipSource | false => item.collectionSources[id] ?? false;
  return collectionsSubmenu(collections, source, (id) =>
    void changeMembership(item.ref, id, source(id) === false),
  );
}

/** A menu of only the Collections submenu, opened from Title information's Collections button. */
export function openMembershipMenu(event: MenuEvent, item: ResolvedItem, collections: readonly CollectionRow[]): void {
  void loadMemberships(item.ref).then((memberships) => {
    openMenu(event, [membershipRow(withMemberships(item, memberships), collections)]);
  }).catch((error: unknown) => useAppStore.getState().say(
    error instanceof Error ? error.message : "Collection memberships could not be read.", "warn",
  ));
}

export interface CardMenuContext {
  readonly collections: readonly CollectionRow[];
  /** The session decides the menu's account rows (`63` section 3.4): signed out there are no collection actions,
   *  and the favorite heart stays, visibly disabled with its reason. */
  readonly signedIn: boolean;
  readonly inHistory: boolean;
  readonly onInfo: () => void;
  readonly onRemoveWatch: () => void;
}

/** A card's menu signed out (`63` section 3.4): Play or Open, Info, and the favorite heart - disabled with the
 *  sign-in sentence, a disabled per-item control reading as broken otherwise. No memberships are read: a signed-out
 *  card asks nothing of the account. */
function signedOutCardMenu(item: ResolvedItem, context: CardMenuContext): Array<MenuItem | false | null | undefined> {
  return [
    item.progress !== undefined && { kind: "heading", label: watchLine(item.progress) },
    { kind: "action", label: item.kind === "tv" ? "Open" : "Play", onSelect: () => playRef(item.ref) },
    { kind: "action", label: "Info", onSelect: context.onInfo },
    {
      kind: "action",
      label: item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite,
      disabled: true,
      disabledReason: LIBRARY_COPY.favoritesSignedOut,
      onSelect: noop,
    },
  ];
}

/** A card's context menu: Play or Open, Info, Favorite, Collections, and in History the removal of the watch entry. */
export function openCardMenu(event: MenuEvent, item: ResolvedItem, context: CardMenuContext): void {
  if (!context.signedIn) {
    openMenu(event, signedOutCardMenu(item, context));
    return;
  }
  void loadMemberships(item.ref).then((memberships) => openMenu(event, [
    item.progress !== undefined && { kind: "heading", label: watchLine(item.progress) },
    { kind: "action", label: item.kind === "tv" ? "Open" : "Play", onSelect: () => playRef(item.ref) },
    { kind: "action", label: "Info", onSelect: context.onInfo },
    {
      kind: "action",
      label: item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite,
      onSelect: () => void changeFavourite(item.ref, !item.favorite),
    },
    { kind: "separator" },
    membershipRow(withMemberships(item, memberships), context.collections),
    context.inHistory && {
      kind: "action",
      label: LIBRARY_COPY.removeWatch,
      disabled: item.watchId === undefined,
      disabledReason: LIBRARY_COPY.noWatchEntry,
      onSelect: context.onRemoveWatch,
    },
  ])).catch((error: unknown) => useAppStore.getState().say(
    error instanceof Error ? error.message : "Collection memberships could not be read.", "warn",
  ));
}

function withMemberships(item: ResolvedItem, memberships: readonly import("@/types/library").Membership[]): ResolvedItem {
  return {
    ...item,
    collectionIds: memberships.map((row) => row.collectionId),
    collectionSources: Object.fromEntries(memberships.map((row) => [row.collectionId, row.source])),
  };
}
