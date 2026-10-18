import {
  CAST_TOO_MANY,
  GENRES_TOO_MANY,
  SAVING_REASON,
  SEASON_TAKEN,
  SEASONS_TOO_MANY,
  TITLE_TOO_LONG,
  UNREACHABLE_REASON,
} from "@/constants/title-copy";
import { rating, required, wholeNumber, type Refusal } from "./field-checks";
import { EPISODES_MAX, hasRepeatedSeason, SEASONS_MAX } from "./season-edit";
import type { NewTitleDraft, TitleDraft } from "./title-draft";
import { commaItems } from "./title-units";

/* The title rules (`37` section 4.1, mirroring `types/title-input.ts`): Title at most 200 characters, Year 1800 to 2200,
 * Rating 0 to 10, Runtime whole minutes, a TMDB id a whole positive number, at most 20 genres and 50 cast names, at most
 * 100 seasons of 500 episodes, each season number once. An empty value passes every rule except `required`. Addresses
 * are the backend's (its address rule depends on its configuration); its `422` names the row. Pure. */

export const TITLE_MAX = 200;
export const YEAR_FIRST = 1800;
export const YEAR_LAST = 2200;
export const GENRES_MAX = 20;
export const CAST_MAX = 50;
const TMDB_ID_MAX = 9_999_999_999;
const MINUTES_MAX = 100_000;

const TITLE_FIELDS = [
  "title",
  "kind",
  "year",
  "enabled",
  "tmdbId",
  "rating",
  "genres",
  "runtimeMs",
  "posterUrl",
  "backdropUrl",
  "streamUrl",
  "plot",
  "cast",
  "seasons",
] as const;
export type TitleField = (typeof TITLE_FIELDS)[number];

/** A backend refusal's field (`seasons.0.episodes`) as the row it sits under. */
export function titleFieldOf(field: string | undefined): TitleField | undefined {
  const head = field?.split(".")[0];
  return TITLE_FIELDS.find((one) => one === head);
}

/** The form field a row's refusal is keyed by in the workspace (Runtime is minutes in the form). */
export const formKeyOf = (field: TitleField): string => (field === "runtimeMs" ? "runtime" : field);

export interface TitleRefusal {
  readonly field: TitleField;
  readonly sentence: string;
}

const first = (checks: ReadonlyArray<readonly [TitleField, Refusal]>): TitleRefusal | null => {
  const found = checks.find(([, sentence]) => sentence !== null);
  return found === undefined || found[1] === null ? null : { field: found[0], sentence: found[1] };
};

const titleLength = (value: string): Refusal => (value.trim().length > TITLE_MAX ? TITLE_TOO_LONG : null);
const yearRule = (value: string): Refusal => wholeNumber("Year", value, YEAR_FIRST, YEAR_LAST);

/** Why `Create` is disabled, in the form's order, or undefined. */
export function createReason(draft: NewTitleDraft, busy: boolean, unreachable: boolean): string | undefined {
  return (
    required("Title", draft.title) ??
    required("Year", draft.year) ??
    (busy ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined)
  );
}

export function firstCreateRefusal(draft: NewTitleDraft): TitleRefusal | null {
  return first([
    ["title", titleLength(draft.title)],
    ["year", yearRule(draft.year)],
  ]);
}

/** Why `Save` is disabled by a required field, or undefined. */
export const saveRequiredReason = (draft: TitleDraft): string | undefined => required("Title", draft.title) ?? undefined;

function seasonsRefusal(draft: TitleDraft): Refusal {
  if (draft.seasons.length > SEASONS_MAX || draft.seasons.some((one) => one.episodes.length > EPISODES_MAX)) {
    return SEASONS_TOO_MANY;
  }
  return hasRepeatedSeason(draft.seasons) ? SEASON_TAKEN : null;
}

/** The first value the workspace refuses when `Save` is pressed, in the page's order, or null. */
export function firstSaveRefusal(draft: TitleDraft, shape: { readonly manual: boolean; readonly series: boolean }): TitleRefusal | null {
  return first([
    ["title", required("Title", draft.title) ?? titleLength(draft.title)],
    ["year", yearRule(draft.year)],
    ["tmdbId", shape.manual ? wholeNumber("TMDB id", draft.tmdbId, 1, TMDB_ID_MAX) : null],
    ["rating", rating("Rating", draft.rating)],
    ["genres", commaItems(draft.genres).length > GENRES_MAX ? GENRES_TOO_MANY : null],
    ["runtimeMs", shape.series ? null : wholeNumber("Runtime", draft.runtime, 0, MINUTES_MAX)],
    ["cast", commaItems(draft.cast).length > CAST_MAX ? CAST_TOO_MANY : null],
    ["seasons", shape.manual && shape.series ? seasonsRefusal(draft) : null],
  ]);
}
