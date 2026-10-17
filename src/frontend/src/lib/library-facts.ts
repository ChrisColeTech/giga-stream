import type { LibraryKind, Progress } from "@/types/library";
import type { TitleDetail } from "@/types/title";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** An episode's code, as the Library writes it: `S01 E02`. */
export function episodeCode(season: number, episode: number): string {
  return `S${pad2(season)} E${pad2(episode)}`;
}

/** The share of a title watched, from 0 to 1, or undefined when its runtime is not known. */
export function progressRatio(progress: Progress): number | undefined {
  if (progress.durationMs === undefined || progress.durationMs <= 0) return undefined;
  return Math.min(1, Math.max(0, progress.positionMs / progress.durationMs));
}

/** A duration as `1 h 14 min`, or `21 min` under an hour. */
export function durationLabel(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The remaining fact of a title: `1 h 14 min left`, `Watched` when finished, or undefined without a runtime. */
export function remainingLabel(progress: Progress): string | undefined {
  if (progress.state === "watched") return "Watched";
  if (progress.durationMs === undefined) return undefined;
  return `${durationLabel(Math.max(0, progress.durationMs - progress.positionMs))} left`;
}

/** The label of a Continue Watching card: the title, or `Series - S01 E02` for an episode in progress. */
export function continueLabel(title: string, progress: Progress | undefined): string {
  const season = progress?.season;
  const episode = progress?.episode;
  if (season === undefined || episode === undefined) return title;
  return `${title} - ${episodeCode(season, episode)}`;
}

/** The watch block's line: the episode, then the watched state or the time left. */
export function watchLine(progress: Progress): string {
  const episode =
    progress.season !== undefined && progress.episode !== undefined
      ? episodeCode(progress.season, progress.episode)
      : undefined;
  const fact = remainingLabel(progress) ?? `${durationLabel(progress.positionMs)} in`;
  return [episode, fact].filter((part): part is string => part !== undefined).join(" · ");
}

export function kindLabel(kind: LibraryKind): string {
  if (kind === "movie") return "Movie";
  if (kind === "tv") return "Series";
  return "Local file";
}

/** The identity line: year, kind and quality, each only when it is a real value. */
export function identityLine(facts: { readonly year?: number; readonly kind: LibraryKind; readonly quality?: string }): string {
  const parts = [facts.year === undefined ? undefined : String(facts.year), kindLabel(facts.kind), facts.quality];
  return parts.filter((part): part is string => part !== undefined && part !== "").join(" · ");
}

/** A series' seasons and episodes, as `2 seasons · 14 episodes`. */
export function seasonsLabel(seasons: NonNullable<TitleDetail["seasons"]>): string {
  const episodes = seasons.reduce((sum, season) => sum + season.episodeCount, 0);
  return `${plural(seasons.length, "season")} · ${plural(episodes, "episode")}`;
}

/** A rating from 0 to 10 with one decimal, as `8.2 / 10`. */
export function ratingLabel(rating: number): string {
  return `${rating.toFixed(1)} / 10`;
}
