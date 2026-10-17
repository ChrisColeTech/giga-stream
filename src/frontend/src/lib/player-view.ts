import { itemKey, type Marks } from "@/lib/library-marks";
import { parseEpisodeCode, progressFraction } from "@/lib/player-format";
import { type PlayerSession } from "@/lib/player-session";
import type { CollectionRow } from "@/types/collection";
import type { LibraryItem, Progress } from "@/types/library";
import type { PlayerLocalState, StageState } from "@/types/player";
import type { Episode, TitleDetail } from "@/types/title";

export type EpisodeMarker = { readonly watched: true } | { readonly watched: false; readonly fraction: number };

export function episodeMarker(
  progress: Progress | undefined,
  season: number | undefined,
  episode: number,
): EpisodeMarker | undefined {
  if (progress === undefined || progress.season !== season || progress.episode !== episode) return undefined;
  if (progress.state === "watched") return { watched: true };
  return { watched: false, fraction: progressFraction(progress.positionMs, progress.durationMs) ?? 0 };
}

export interface PlayerData {
  readonly item?: LibraryItem;
  readonly detail?: TitleDetail;
  readonly local?: PlayerLocalState;
  readonly episodes?: readonly Episode[];
  readonly related?: readonly LibraryItem[];
  readonly collections?: readonly CollectionRow[];
  readonly stage?: StageState;
}

export interface PlayerView {
  readonly tab: NonNullable<PlayerSession["current"]> | undefined;
  readonly item: LibraryItem | undefined;
  readonly detail: TitleDetail | undefined;
  readonly local: PlayerLocalState | undefined;
  readonly stage: StageState;
  readonly favorite: boolean;
  readonly memberIds: readonly string[];
  readonly collections: readonly CollectionRow[];
  readonly season: number | undefined;
  readonly episode: number | undefined;
  readonly seasons: readonly { readonly season: number; readonly episodeCount: number }[];
  readonly episodes: readonly Episode[];
  readonly related: readonly LibraryItem[];
}

export function stageSubtitle(view: PlayerView): string | undefined {
  const tab = view.tab;
  if (tab === undefined) return undefined;
  if (tab.kind === "local") return "Local file";
  if (tab.kind === "movie") return view.detail?.year === undefined ? undefined : String(view.detail.year);
  const name = view.episodes.find((candidate) => candidate.episode === view.episode)?.title;
  return [tab.subtitle, name].filter((part): part is string => part !== undefined).join(" · ") || undefined;
}

export function resumeOf(view: PlayerView): Progress | undefined {
  const progress = view.item?.progress;
  // A row opened by Play and not yet played (position 0) has nothing to resume: no `resume at 0:00`.
  if (progress?.state !== "watching" || progress.positionMs <= 0) return undefined;
  if (view.tab?.kind !== "tv") return progress;
  const playing = parseEpisodeCode(view.tab.subtitle);
  return playing !== undefined && progress.season === playing.season && progress.episode === playing.episode
    ? progress
    : undefined;
}

export function viewOf(session: PlayerSession, marks: Marks, data: PlayerData = {}): PlayerView {
  const tab = session.current ?? undefined;
  const chosen = parseEpisodeCode(tab?.subtitle);
  const seasons = data.detail?.seasons ?? [];
  const season = tab?.kind === "tv" ? (session.season ?? chosen?.season ?? seasons[0]?.season) : undefined;
  const key = tab === undefined ? undefined : itemKey(tab.ref);
  return {
    tab,
    item: data.item ?? tab?.libraryItem,
    detail: data.detail,
    local: data.local,
    stage: data.stage ?? { kind: "idle" },
    favorite: key === undefined ? false : (marks.favourites[key] ?? data.item?.favorite ?? tab?.libraryItem?.favorite ?? false),
    memberIds: key === undefined ? [] : (marks.memberships[key] ?? data.local?.info?.collectionIds ?? []),
    collections: data.collections ?? [],
    season,
    episode: tab?.kind === "tv" && chosen !== undefined && chosen.season === season ? chosen.episode : undefined,
    seasons,
    episodes: data.episodes ?? [],
    related: data.related ?? [],
  };
}
