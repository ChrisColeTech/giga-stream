import { useEffect, useRef, useState } from "react";
import type { LoadedPlayerData } from "@/hooks/usePlayerData";
import {
  episodeAdjacency, type EpisodeAdjacency, type EpisodeTarget, type SeasonRead,
} from "@/lib/episode-adjacency";
import { readSeason } from "@/services/titles";
import type { PlayerView } from "@/lib/player-view";

interface TitleCache {
  readonly titleId: string;
  readonly reads: Map<number, SeasonRead>;
}

const requestKeyOf = (adjacency: EpisodeAdjacency, currentSeason: number): string => [
  adjacency.previous.readSeason,
  adjacency.next.readSeason,
].filter((season): season is number => season !== undefined && season !== currentSeason)
  .sort((left, right) => left - right).join(":");

/** Caches complete season answers for the current title and reads only unresolved cross-season boundaries. */
export function useEpisodeAdjacency(
  view: PlayerView,
  data: LoadedPlayerData,
  current: EpisodeTarget | undefined,
): EpisodeAdjacency | undefined {
  const titleId = view.tab?.kind === "tv" && view.tab.ref.kind === "title" ? view.tab.ref.id : undefined;
  const cache = useRef<TitleCache | null>(null);
  const [, revise] = useState(0);
  if (titleId !== undefined && cache.current?.titleId !== titleId) {
    cache.current = { titleId, reads: new Map() };
  } else if (titleId === undefined) {
    cache.current = null;
  }
  const reads = cache.current?.reads;
  if (reads !== undefined && current !== undefined) {
    if (data.playingPending) reads.set(current.season, { kind: "pending" });
    else if (data.playingFailed) reads.set(current.season, { kind: "failed" });
    else if (data.playingEpisodesSeason === current.season) {
      reads.set(current.season, { kind: "ready", episodes: data.playingEpisodes });
    }
    if (view.season !== undefined && data.episodesSeason === view.season) {
      reads.set(view.season, { kind: "ready", episodes: data.episodes });
    }
  }
  const result = reads === undefined || current === undefined
    ? undefined
    : episodeAdjacency(view.seasons, reads, current);
  const requestKey = result === undefined || current === undefined ? "" : requestKeyOf(result, current.season);

  useEffect(() => {
    const scope = cache.current;
    if (scope === null || scope.titleId !== titleId || requestKey === "") return;
    for (const season of requestKey.split(":").map(Number)) {
      if (scope.reads.has(season)) continue;
      scope.reads.set(season, { kind: "pending" });
      void readSeason(scope.titleId, season).then((answer) => {
        if (cache.current !== scope) return;
        scope.reads.set(season, { kind: "ready", episodes: answer.episodes });
        revise((value) => value + 1);
      }).catch(() => {
        if (cache.current !== scope) return;
        scope.reads.set(season, { kind: "failed" });
        revise((value) => value + 1);
      });
    }
  }, [requestKey, titleId]);
  return result;
}
