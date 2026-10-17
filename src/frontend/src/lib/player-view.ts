import { COLLECTION_ROWS } from "@/fixtures/collections";
import { LIBRARY_ITEMS, RELATED_ITEMS, SERIES_EPISODES, TITLE_DETAILS } from "@/fixtures/titles";
import { PLAYER_STAGE } from "@/fixtures/player";
import { RELATED_LIMIT } from "@/lib/player-copy";
import { parseEpisodeCode, progressFraction } from "@/lib/player-format";
import { type PlayerSession, sameRef } from "@/lib/player-session";
import type { CollectionRow } from "@/types/collection";
import type { LibraryItem, Progress } from "@/types/library";
import type { Episode, TitleDetail } from "@/types/title";
import type { PlayerTab, StageState } from "@/types/player";

const IDLE: StageState = { kind: "idle" };

/** The watch marker of one exact episode: watched, or in progress with its fraction. */
export type EpisodeMarker = { readonly watched: true } | { readonly watched: false; readonly fraction: number };

/** The marker of episode `episode` of season `season`, from the title's progress. Only the exact episode has one. */
export function episodeMarker(
  progress: Progress | undefined,
  season: number | undefined,
  episode: number,
): EpisodeMarker | undefined {
  if (progress === undefined || progress.season !== season || progress.episode !== episode) return undefined;
  if (progress.state === "watched") return { watched: true };
  return { watched: false, fraction: progressFraction(progress.positionMs, progress.durationMs) ?? 0 };
}

/** Everything the Player's panes draw, derived from the session and the phase 1 fixtures. Components take this and
 *  callbacks; they never read a fixture themselves. */
export interface PlayerView {
  readonly tab: PlayerTab | undefined;
  readonly item: LibraryItem | undefined;
  readonly detail: TitleDetail | undefined;
  readonly stage: StageState;
  readonly favorite: boolean;
  readonly memberIds: readonly string[];
  readonly collections: readonly CollectionRow[];
  /** A series' season that the browser shows; absent for other kinds. */
  readonly season: number | undefined;
  /** The exact episode the tab names, from its subtitle. */
  readonly episode: number | undefined;
  readonly seasons: readonly { readonly season: number; readonly episodeCount: number }[];
  readonly episodes: readonly Episode[];
  readonly related: readonly LibraryItem[];
}

/** The line beneath the stage title: the exact episode and its name, a movie's year, or the kind of local file. */
export function stageSubtitle(view: PlayerView): string | undefined {
  const tab = view.tab;
  if (tab === undefined) return undefined;
  if (tab.kind === "local") return "Local file";
  if (tab.kind === "movie") {
    const year = view.detail?.year;
    return year === undefined ? undefined : String(year);
  }
  const name = view.episodes.find((candidate) => candidate.episode === view.episode)?.title;
  return [tab.subtitle, name].filter((part): part is string => part !== undefined).join(" · ") || undefined;
}

/** The progress a Resume banner offers: a title left partway, and nothing for one watched through. */
export function resumeOf(view: PlayerView): Progress | undefined {
  const progress = view.item?.progress;
  return progress?.state === "watching" ? progress : undefined;
}

export function viewOf(session: PlayerSession): PlayerView {
  const tab = session.current ?? undefined;
  if (tab === undefined) {
    return {
      tab: undefined,
      item: undefined,
      detail: undefined,
      stage: IDLE,
      favorite: false,
      memberIds: [],
      collections: COLLECTION_ROWS,
      season: undefined,
      episode: undefined,
      seasons: [],
      episodes: [],
      related: [],
    };
  }

  const item = LIBRARY_ITEMS.find((candidate) => sameRef(candidate.ref, tab.ref));
  const detail = TITLE_DETAILS[tab.ref.id];
  const seasons = detail?.seasons ?? [];
  const chosen = parseEpisodeCode(tab.subtitle);
  const season = tab.kind === "tv" ? (session.season ?? chosen?.season ?? seasons[0]?.season) : undefined;
  const episodes = (SERIES_EPISODES[tab.ref.id] ?? []).filter((episode) => episode.season === season);
  const related = tab.kind === "local" ? [] : (RELATED_ITEMS[tab.ref.id] ?? []).slice(0, RELATED_LIMIT);

  return {
    tab,
    item,
    detail,
    stage: PLAYER_STAGE[tab.id] ?? IDLE,
    favorite: session.favorites[tab.ref.id] ?? item?.favorite ?? false,
    memberIds: session.membership[tab.ref.id] ?? [],
    collections: COLLECTION_ROWS,
    season,
    episode: tab.kind === "tv" ? chosen?.episode : undefined,
    seasons,
    episodes,
    related,
  };
}
