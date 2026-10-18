import { asRecord, listOf, num, str } from "./title-shapes.js";

/** One episode as the season route answers it (docs/03 section 7.4): TMDB's season answer, mapped. */
export function episodesOf(season: number, answer: Record<string, unknown>): Record<string, unknown>[] {
  return listOf(answer.episodes).map((e) => {
    const row = asRecord(e);
    const runtime = num(row.runtime);
    return {
      season,
      episode: num(row.episode_number) ?? 0,
      title: str(row.name),
      airDate: str(row.air_date),
      ...(runtime !== undefined && { runtimeMs: runtime * 60_000 }),
      stillUrl: str(row.still_path) ? `https://image.tmdb.org/t/p/w300${row.still_path}` : undefined,
    };
  });
}

/**
 * A fresh detail's `seasons` keep the episodes (and the time they were read) a stored season already holds, so a
 * refreshed detail does not throw them away. A season whose episode count changed is left bare: its episodes are
 * read again.
 */
export function keepEpisodes(payload: Record<string, unknown>, previous: unknown): void {
  const old = listOf(asRecord(previous).seasons).map(asRecord);
  if (old.length === 0 || !Array.isArray(payload.seasons)) return;
  payload.seasons = listOf(payload.seasons).map((entry) => {
    const season = asRecord(entry);
    const had = old.find((s) => s.season === season.season);
    const episodes = had?.episodes;
    if (!Array.isArray(episodes) || episodes.length !== season.episodeCount) return season;
    return { ...season, episodes, episodesAt: had?.episodesAt };
  });
}

/**
 * The seasons of a series payload that still need their episodes: none stored, or stored before `staleBefore`. Season 0
 * (the specials) is never asked for.
 */
export function seasonsMissing(payload: Record<string, unknown>, staleBefore: number): number[] {
  return listOf(payload.seasons).map(asRecord).flatMap((s) => {
    const season = num(s.season);
    const at = num(s.episodesAt);
    const fresh = Array.isArray(s.episodes) && at !== undefined && at >= staleBefore;
    return season === undefined || season < 1 || fresh ? [] : [season];
  });
}

/**
 * Writes the episodes of every `season/N` the answer carries (TMDB's `append_to_response=season/N` puts each under that
 * key) onto the matching season of the payload, and answers how many it wrote. A key the answer lacks, or one without
 * episodes, leaves that season as it was: the next run asks again.
 */
export function mergeSeasons(payload: Record<string, unknown>, answer: Record<string, unknown>, at: number): number {
  let merged = 0;
  payload.seasons = listOf(payload.seasons).map((entry) => {
    const season = asRecord(entry);
    const n = num(season.season);
    const got = n === undefined ? undefined : asRecord(answer[`season/${n}`]);
    if (n === undefined || got === undefined || !Array.isArray(got.episodes)) return season;
    merged += 1;
    return { ...season, episodes: episodesOf(n, got), episodesAt: at };
  });
  return merged;
}

/** A synced series' seasons as a public answer shows them: counts only, the episodes are the season route's. */
export function withoutEpisodes(payload: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(payload.seasons)) return payload;
  const seasons = listOf(payload.seasons).map((entry) => {
    const { episodes: _episodes, episodesAt: _at, ...rest } = asRecord(entry);
    return rest;
  });
  return { ...payload, seasons };
}
