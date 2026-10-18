import type { AdminTitleDetail } from "@/services/schemas/title-schema";
import { sameSeasons, type SeasonDraft } from "./season-edit";
import { draftOfTitle, type NewTitleDraft, type TitleDraft } from "./title-draft";
import { commaItems, numberOf, runtimeMsOf } from "./title-units";

/* The request bodies of the Titles routes (`37` section 4.1), pure. A create posts a manual title. A save is a strict
 * `PATCH` of ONLY the fields that differ from the saved title; an emptied optional field is `null` (clears).
 * `tmdbId` is sent only for a title made by hand, Runtime only for a movie, the seasons only for a manual series. */

export type TitleBody = Readonly<Record<string, unknown>>;

export function titleCreateBody(draft: NewTitleDraft): TitleBody {
  const year = numberOf(draft.year);
  return { kind: draft.kind, title: draft.title.trim(), ...(year !== undefined && { year }) };
}

/** The seasons as the backend takes them: each episode its number, its title when there is one, and the kept fields. */
export const seasonsBody = (seasons: readonly SeasonDraft[]): unknown[] =>
  seasons.map((season) => ({
    season: season.season,
    episodes: season.episodes.map((episode) => {
      const title = episode.title.trim();
      return { episode: episode.episode, ...(title !== "" && { title }), ...episode.rest };
    }),
  }));

export interface TitleShape {
  readonly manual: boolean;
  readonly series: boolean;
}

const optional = <T>(value: T | undefined): T | null => value ?? null;
const textValue = (value: string): string | null => (value.trim() === "" ? null : value.trim());
const listValue = (value: string): string[] | null => {
  const items = commaItems(value);
  return items.length === 0 ? null : items;
};

/** The `PATCH` body: the changed fields only, in the backend's names and units. */
export function titleChanges(saved: AdminTitleDetail, draft: TitleDraft, shape: TitleShape): TitleBody {
  const before = draftOfTitle(saved);
  const body: Record<string, unknown> = {};
  type TextKey = keyof Omit<TitleDraft, "enabled" | "seasons">;
  const changed = (key: TextKey): boolean => draft[key].trim() !== before[key].trim();
  if (changed("title")) body["title"] = draft.title.trim();
  if (changed("year")) body["year"] = optional(numberOf(draft.year));
  if (draft.enabled !== before.enabled) body["enabled"] = draft.enabled;
  if (shape.manual && changed("tmdbId")) body["tmdbId"] = optional(numberOf(draft.tmdbId));
  if (changed("rating")) body["rating"] = optional(numberOf(draft.rating));
  if (changed("genres")) body["genres"] = listValue(draft.genres);
  if (!shape.series && changed("runtime")) body["runtimeMs"] = optional(runtimeMsOf(draft.runtime));
  for (const key of ["posterUrl", "backdropUrl", "streamUrl", "plot"] as const) {
    if (changed(key)) body[key] = textValue(draft[key]);
  }
  if (changed("cast")) body["cast"] = listValue(draft.cast);
  if (shape.manual && shape.series && !sameSeasons(draft.seasons, before.seasons)) {
    body["seasons"] = draft.seasons.length === 0 ? null : seasonsBody(draft.seasons);
  }
  return body;
}

export const isEmptyTitleBody = (body: TitleBody): boolean => Object.keys(body).length === 0;
