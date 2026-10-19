import {
  EPISODE_LOADING_REASON,
  EPISODE_READ_FAILURE_REASON,
  FIRST_EPISODE_REASON,
  LAST_EPISODE_REASON,
} from "@/lib/player-copy";
import type { Episode, TitleDetail } from "@/types/title";

export type SeasonRead =
  | { readonly kind: "ready"; readonly episodes: readonly Episode[] }
  | { readonly kind: "pending" }
  | { readonly kind: "failed" };

export interface EpisodeTarget {
  readonly season: number;
  readonly episode: number;
}

export interface EpisodeDirection {
  readonly target?: EpisodeTarget;
  readonly reason?: string;
  readonly readSeason?: number;
}

export interface EpisodeAdjacency {
  readonly previous: EpisodeDirection;
  readonly next: EpisodeDirection;
}

type SeasonSummary = NonNullable<TitleDetail["seasons"]>[number];

const sortedEpisodes = (read: SeasonRead): readonly Episode[] => read.kind === "ready"
  ? [...read.episodes].filter((episode) => episode.season > 0 && episode.episode > 0)
      .sort((left, right) => left.episode - right.episode)
  : [];

const unavailable = (read: SeasonRead | undefined, season: number): EpisodeDirection => {
  if (read?.kind === "failed") return { reason: EPISODE_READ_FAILURE_REASON };
  return { reason: EPISODE_LOADING_REASON, ...(read === undefined ? { readSeason: season } : {}) };
};

function direction(
  seasons: readonly SeasonSummary[],
  reads: ReadonlyMap<number, SeasonRead>,
  current: EpisodeTarget,
  step: -1 | 1,
): EpisodeDirection {
  const currentRead = reads.get(current.season);
  if (currentRead?.kind !== "ready") return unavailable(currentRead, current.season);
  const sameSeason = sortedEpisodes(currentRead).filter((episode) => step < 0
    ? episode.episode < current.episode
    : episode.episode > current.episode);
  const nearest = step < 0 ? sameSeason.at(-1) : sameSeason[0];
  if (nearest !== undefined) return { target: { season: nearest.season, episode: nearest.episode } };

  const candidates = seasons.filter((summary) => step < 0
    ? summary.season < current.season
    : summary.season > current.season);
  if (step < 0) candidates.reverse();
  for (const summary of candidates) {
    const read = reads.get(summary.season);
    if (read?.kind !== "ready") return unavailable(read, summary.season);
    const episodes = sortedEpisodes(read);
    const target = step < 0 ? episodes.at(-1) : episodes[0];
    if (target !== undefined) return { target: { season: target.season, episode: target.episode } };
  }
  return { reason: step < 0 ? FIRST_EPISODE_REASON : LAST_EPISODE_REASON };
}

export function episodeAdjacency(
  summaries: readonly SeasonSummary[],
  reads: ReadonlyMap<number, SeasonRead>,
  current: EpisodeTarget,
): EpisodeAdjacency {
  const seasons = [...summaries]
    .filter((summary) => summary.season > 0 && summary.episodeCount > 0)
    .sort((left, right) => left.season - right.season)
    .filter((summary, index, rows) => index === 0 || rows[index - 1]?.season !== summary.season);
  return {
    previous: direction(seasons, reads, current, -1),
    next: direction(seasons, reads, current, 1),
  };
}
