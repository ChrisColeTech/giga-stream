import type { AdminTitleDetail, AdminTitleRow } from "@/services/schemas/title-schema";
import type { EpisodeDraft, SeasonDraft } from "./season-edit";
import { sameSeasons } from "./season-edit";
import type { TitleKind } from "./title-query";
import { commaText, minutesOf, textOf } from "./title-units";

/* The Titles forms' values (`37` sections 4.2 and 4.3), pure. Fields hold what the person types (numbers as text, so an
 * emptied field is "" and means absent); a draft is compared with the saved title's draft, so `dirty` is a fact about
 * values. Title (the record's name) comes first on every form. */

export interface NewTitleDraft {
  readonly title: string;
  readonly kind: TitleKind;
  readonly year: string;
}

export const EMPTY_NEW_TITLE: NewTitleDraft = { title: "", kind: "movie", year: "" };

export const sameNewTitle = (a: NewTitleDraft, b: NewTitleDraft): boolean =>
  a.title === b.title && a.kind === b.kind && a.year === b.year;

export interface TitleDraft {
  readonly title: string;
  readonly year: string;
  readonly enabled: boolean;
  readonly tmdbId: string;
  readonly rating: string;
  readonly genres: string;
  readonly runtime: string;
  readonly posterUrl: string;
  readonly backdropUrl: string;
  readonly streamUrl: string;
  readonly plot: string;
  readonly cast: string;
  readonly seasons: readonly SeasonDraft[];
}

const record = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : {};
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** One stored episode as the editor's row; the fields the editor does not show are kept in `rest`. */
function episodeOf(value: unknown): EpisodeDraft | null {
  const row = record(value);
  const episode = num(row["episode"]);
  if (episode === undefined) return null;
  const airDate = str(row["airDate"]);
  const runtimeMs = num(row["runtimeMs"]);
  const stillUrl = str(row["stillUrl"]);
  const streamUrl = str(row["streamUrl"]);
  return {
    episode,
    title: str(row["title"]) ?? "",
    rest: {
      ...(airDate !== undefined && { airDate }),
      ...(runtimeMs !== undefined && { runtimeMs }),
      ...(stillUrl !== undefined && { stillUrl }),
      ...(streamUrl !== undefined && { streamUrl }),
    },
  };
}

/** A manual series' seasons with their episodes (a synced series' seasons are counts and are never edited). */
export function seasonsOf(detail: Pick<AdminTitleDetail, "seasons">): SeasonDraft[] {
  return (detail.seasons ?? []).map((season) => ({
    season: season.season,
    episodes: (season.episodes ?? []).flatMap((one) => {
      const episode = episodeOf(one);
      return episode === null ? [] : [episode];
    }),
  }));
}

export function draftOfTitle(title: AdminTitleRow | AdminTitleDetail): TitleDraft {
  const detail: Partial<AdminTitleDetail> = title;
  return {
    title: title.title,
    year: textOf(title.year),
    enabled: title.enabled !== false,
    tmdbId: textOf(title.tmdbId),
    rating: textOf(title.rating),
    genres: commaText(title.genres),
    runtime: minutesOf(detail.runtimeMs),
    posterUrl: title.posterUrl ?? "",
    backdropUrl: title.backdropUrl ?? "",
    streamUrl: title.streamUrl ?? "",
    plot: detail.plot ?? "",
    cast: commaText(detail.cast),
    seasons: seasonsOf(detail),
  };
}

const TEXT_KEYS = [
  "title",
  "year",
  "tmdbId",
  "rating",
  "genres",
  "runtime",
  "posterUrl",
  "backdropUrl",
  "streamUrl",
  "plot",
  "cast",
] as const satisfies ReadonlyArray<keyof TitleDraft>;

export const sameTitleDraft = (a: TitleDraft, b: TitleDraft): boolean =>
  TEXT_KEYS.every((key) => a[key] === b[key]) && a.enabled === b.enabled && sameSeasons(a.seasons, b.seasons);
