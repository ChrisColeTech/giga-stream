import { formatEpisodeCode } from "@/lib/player-format";
import type { ItemRef, LibraryItem } from "@/types/library";
import type { PlayerTab } from "@/types/player";

/** The Player's ephemeral state (`21` section 1: component state in phase 1). One title or file at a time, with no tabs
 *  (`06` section 5.1). Pure data; the reducer below is the only thing that changes it. */
export interface PlayerSession {
  /** The title or file in the Player, or none: the idle state. */
  readonly current: PlayerTab | null;
  /** The season a series' browser shows. */
  readonly season: number | undefined;
  /** Favourite overrides by item id; absent means the library's own value. */
  readonly favorites: Readonly<Record<string, boolean>>;
  /** The collections each item is in, by item id. */
  readonly membership: Readonly<Record<string, readonly string[]>>;
  readonly relatedFolded: boolean;
}

export type PlayerAction =
  | { readonly type: "open"; readonly item: PlayerTab }
  | { readonly type: "close" }
  | { readonly type: "season"; readonly season: number }
  | { readonly type: "episode"; readonly season: number; readonly episode: number }
  | { readonly type: "favorite"; readonly itemId: string; readonly value: boolean }
  | { readonly type: "toggleMember"; readonly itemId: string; readonly collectionId: string }
  | { readonly type: "toggleRelated" };

/** Two references name the same thing when their kind and id match. */
export function sameRef(a: ItemRef, b: ItemRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** The item a library entry opens in the Player: identified by its reference. */
export function itemFromLibrary(item: LibraryItem): PlayerTab {
  return { id: item.ref.id, ref: item.ref, kind: item.kind, title: item.title };
}

export function createPlayerSession(
  current: PlayerTab | null,
  membership: Readonly<Record<string, readonly string[]>>,
): PlayerSession {
  return { current, season: undefined, favorites: {}, membership, relatedFolded: false };
}

/** Opening the item already playing does nothing but show the Player; opening another replaces the current one. */
function openItem(session: PlayerSession, item: PlayerTab): PlayerSession {
  if (session.current !== null && sameRef(session.current.ref, item.ref)) return session;
  return { ...session, current: item, season: undefined };
}

/** Choosing an exact episode loads it in place; the season select alone starts nothing. */
function chooseEpisode(session: PlayerSession, season: number, episode: number): PlayerSession {
  if (session.current === null) return session;
  return {
    ...session,
    current: { ...session.current, subtitle: formatEpisodeCode(season, episode) },
    season,
  };
}

function toggleMember(session: PlayerSession, itemId: string, collectionId: string): PlayerSession {
  const current = session.membership[itemId] ?? [];
  const next = current.includes(collectionId)
    ? current.filter((id) => id !== collectionId)
    : [...current, collectionId];
  return { ...session, membership: { ...session.membership, [itemId]: next } };
}

export function reducePlayerSession(session: PlayerSession, action: PlayerAction): PlayerSession {
  switch (action.type) {
    case "open":
      return openItem(session, action.item);
    case "close":
      return { ...session, current: null, season: undefined };
    case "season":
      return session.current === null ? session : { ...session, season: action.season };
    case "episode":
      return chooseEpisode(session, action.season, action.episode);
    case "favorite":
      return { ...session, favorites: { ...session.favorites, [action.itemId]: action.value } };
    case "toggleMember":
      return toggleMember(session, action.itemId, action.collectionId);
    case "toggleRelated":
      return { ...session, relatedFolded: !session.relatedFolded };
  }
}
