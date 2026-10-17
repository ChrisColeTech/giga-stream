import { formatEpisodeCode, parseEpisodeCode } from "@/lib/player-format";
import type { ItemRef, LibraryItem } from "@/types/library";
import type { PlayerTab } from "@/types/player";

/** The Player's ephemeral state (`21` section 1: component state in phase 1). One title or file at a time, with no tabs
 *  (`06` section 5.1). Pure data; the reducer below is the only thing that changes it. Favourites and memberships are
 *  not here: they are the store's marks, shared with Library and Title information. */
export interface PlayerSession {
  /** The title or file in the Player, or none: the idle state. */
  readonly current: PlayerTab | null;
  /** The season a series' browser shows. */
  readonly season: number | undefined;
}

export type PlayerAction =
  | { readonly type: "open"; readonly item: PlayerTab }
  | { readonly type: "close" }
  | { readonly type: "season"; readonly season: number }
  | { readonly type: "episode"; readonly season: number; readonly episode: number };

/** Two references name the same thing when their kind and id match. */
export function sameRef(a: ItemRef, b: ItemRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** The item a library entry opens in the Player: identified by its reference. A series left partway opens on the episode
 *  it was left at, so its season shows and that episode is the selected row. */
export function itemFromLibrary(item: LibraryItem): PlayerTab {
  const progress = item.progress;
  const resumable =
    item.kind === "tv" && progress?.season !== undefined && progress.episode !== undefined
      ? formatEpisodeCode(progress.season, progress.episode)
      : undefined;
  return { id: item.ref.id, ref: item.ref, kind: item.kind, title: item.title, subtitle: resumable, libraryItem: item };
}

export function fallbackPlayerItem(ref: ItemRef): LibraryItem {
  return {
    ref,
    kind: ref.kind === "local" ? "local" : ref.id.startsWith("tv-") ? "tv" : "movie",
    title: ref.id,
    genres: [],
    favorite: false,
  };
}

export function playingEpisodeOf(session: PlayerSession): { readonly season: number; readonly episode: number } | undefined {
  return parseEpisodeCode(session.current?.subtitle);
}

export function playerPlaybackKey(session: PlayerSession): string {
  const playing = playingEpisodeOf(session);
  return session.current === null
    ? "idle"
    : `${session.current.ref.kind}:${session.current.ref.id}:${playing?.season ?? 0}:${playing?.episode ?? 0}`;
}

export function createPlayerSession(current: PlayerTab | null): PlayerSession {
  const chosen = current?.subtitle === undefined ? undefined : current.subtitle.match(/^S(\d+) E\d+$/);
  return { current, season: chosen === undefined || chosen === null ? undefined : Number(chosen[1]) };
}

/** Whether a session already has this item open: opening it again only shows the Player. */
export function isOpen(session: PlayerSession, ref: ItemRef): boolean {
  return session.current !== null && sameRef(session.current.ref, ref);
}

/** Opening the item already playing does nothing but show the Player; opening another replaces the current one. */
function openItem(session: PlayerSession, item: PlayerTab): PlayerSession {
  if (isOpen(session, item.ref)) return session;
  return createPlayerSession(item);
}

/** Choosing an exact episode loads it in place; the season select alone starts nothing. */
function chooseEpisode(session: PlayerSession, season: number, episode: number): PlayerSession {
  if (session.current === null) return session;
  return { current: { ...session.current, subtitle: formatEpisodeCode(season, episode) }, season };
}

export function reducePlayerSession(session: PlayerSession, action: PlayerAction): PlayerSession {
  switch (action.type) {
    case "open":
      return openItem(session, action.item);
    case "close":
      return { current: null, season: undefined };
    case "season":
      return session.current === null ? session : { ...session, season: action.season };
    case "episode":
      return chooseEpisode(session, action.season, action.episode);
  }
}
