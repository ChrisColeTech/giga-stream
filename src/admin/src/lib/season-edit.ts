import type { TitleEpisode } from "@/services/schemas/title-schema";

/* A manual series' seasons as the Seasons editor holds them (`37` section 4.3), pure: an ordered list of seasons, each
 * a number and its episodes (a number and a title). The other episode fields the backend keeps (air date, runtime,
 * still, stream) ride along untouched in `rest`, so an edit never drops them. Every function returns a new list. */

export interface EpisodeDraft {
  readonly episode: number;
  readonly title: string;
  readonly rest: Omit<TitleEpisode, "episode" | "title">;
}

export interface SeasonDraft {
  readonly season: number;
  readonly episodes: readonly EpisodeDraft[];
}

export const SEASONS_MAX = 100;
export const EPISODES_MAX = 500;
export const SEASON_NUMBER_MAX = 100;

const nextNumber = (numbers: readonly number[]): number => (numbers.length === 0 ? 1 : Math.max(...numbers) + 1);

/** A season with the next free number and no episodes. */
export function addSeason(seasons: readonly SeasonDraft[]): SeasonDraft[] {
  if (seasons.length >= SEASONS_MAX) return [...seasons];
  const season = Math.min(SEASON_NUMBER_MAX, nextNumber(seasons.map((one) => one.season)));
  return [...seasons, { season, episodes: [] }];
}

export const removeSeason = (seasons: readonly SeasonDraft[], index: number): SeasonDraft[] =>
  seasons.filter((_, at) => at !== index);

/** Moves a season one place up (-1) or down (1); at an end it stays. */
export function moveSeason(seasons: readonly SeasonDraft[], index: number, by: -1 | 1): SeasonDraft[] {
  const to = index + by;
  const moving = seasons[index];
  const other = seasons[to];
  if (moving === undefined || other === undefined) return [...seasons];
  return seasons.map((season, at) => (at === index ? other : at === to ? moving : season));
}

const replaceAt = (seasons: readonly SeasonDraft[], index: number, next: SeasonDraft): SeasonDraft[] =>
  seasons.map((season, at) => (at === index ? next : season));

export function setSeasonNumber(seasons: readonly SeasonDraft[], index: number, season: number): SeasonDraft[] {
  const current = seasons[index];
  return current === undefined ? [...seasons] : replaceAt(seasons, index, { ...current, season });
}

/** An episode with the next free number in that season. */
export function addEpisode(seasons: readonly SeasonDraft[], index: number): SeasonDraft[] {
  const current = seasons[index];
  if (current === undefined || current.episodes.length >= EPISODES_MAX) return [...seasons];
  const episode = nextNumber(current.episodes.map((one) => one.episode));
  return replaceAt(seasons, index, { ...current, episodes: [...current.episodes, { episode, title: "", rest: {} }] });
}

export function removeEpisode(seasons: readonly SeasonDraft[], index: number, at: number): SeasonDraft[] {
  const current = seasons[index];
  if (current === undefined) return [...seasons];
  return replaceAt(seasons, index, { ...current, episodes: current.episodes.filter((_, one) => one !== at) });
}

export function setEpisode(
  seasons: readonly SeasonDraft[],
  index: number,
  at: number,
  patch: Partial<Pick<EpisodeDraft, "episode" | "title">>,
): SeasonDraft[] {
  const current = seasons[index];
  if (current === undefined) return [...seasons];
  const episodes = current.episodes.map((episode, one) => (one === at ? { ...episode, ...patch } : episode));
  return replaceAt(seasons, index, { ...current, episodes });
}

/** A season number used twice: the backend would keep both, so the form refuses it. */
export const hasRepeatedSeason = (seasons: readonly SeasonDraft[]): boolean =>
  new Set(seasons.map((one) => one.season)).size !== seasons.length;

export function sameSeasons(a: readonly SeasonDraft[], b: readonly SeasonDraft[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
