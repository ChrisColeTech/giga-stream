import {
  FRAME_ORIGINS_MAX_REFUSAL,
  ORIGIN_SHAPE,
  SAVING_REASON,
  TEMPLATE_HTTPS,
  TEMPLATE_PLACEHOLDERS,
  TEXT_TOO_LONG,
  UNREACHABLE_REASON,
} from "@/constants/provider-copy";
import { required, type Refusal } from "./field-checks";
import { showsTemplates, type NewProviderDraft, type ProviderDraft } from "./provider-draft";

/* The provider rules (`37` section 3.1), mirroring the backend's `types/provider.ts` so a form refuses before it sends:
 * a template is an https address with its placeholders, an origin is an https origin with no path, at most 8 frame
 * origins, and the text limits. An empty value passes every rule except `required`. Pure. */

export const NAME_MAX = 120;
export const SOURCE_MAX = 60;
export const PARAM_MAX = 60;
export const ADDRESS_MAX = 2048;
export const FRAME_ORIGINS_MAX = 8;

export const MOVIE_PLACEHOLDERS: readonly string[] = ["{tmdbId}"];
export const EPISODE_PLACEHOLDERS: readonly string[] = ["{tmdbId}", "{season}", "{episode}"];

/** What the frame-origin chips accept, after `ChipsInput` lower-cases a token: an https host and an optional port. */
const LABEL = "[a-z0-9]([a-z0-9-]*[a-z0-9])?";
export const FRAME_ORIGIN_PATTERN = new RegExp(`^https://${LABEL}(\\.${LABEL})*(:\\d{1,5})?$`);

const words = (items: readonly string[]): string =>
  items.length === 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;

export function templateRefusal(label: string, value: string, placeholders: readonly string[]): Refusal {
  const text = value.trim();
  if (text === "") return null;
  if (text.length > ADDRESS_MAX) return TEXT_TOO_LONG(label, ADDRESS_MAX);
  if (!text.startsWith("https://")) return TEMPLATE_HTTPS(label);
  const complete = placeholders.every((placeholder) => text.includes(placeholder));
  return complete ? null : TEMPLATE_PLACEHOLDERS(label, words(placeholders));
}

export function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const bare = (url.pathname === "/" || url.pathname === "") && url.search === "" && url.hash === "";
    return url.protocol === "https:" && url.hostname !== "" && bare;
  } catch {
    return false;
  }
}

export function originRefusal(value: string): Refusal {
  const text = value.trim();
  return text === "" || isHttpsOrigin(text) ? null : ORIGIN_SHAPE;
}

export function frameOriginsRefusal(origins: readonly string[]): Refusal {
  if (origins.length > FRAME_ORIGINS_MAX) return FRAME_ORIGINS_MAX_REFUSAL;
  return origins.every(isHttpsOrigin) ? null : ORIGIN_SHAPE;
}

const tooLong = (label: string, value: string, max: number): Refusal =>
  value.trim().length > max ? TEXT_TOO_LONG(label, max) : null;

/** The fields of the provider forms, as the backend names them. */
const PROVIDER_FIELDS = [
  "name",
  "family",
  "source",
  "movieTemplate",
  "enabled",
  "order",
  "episodeTemplate",
  "startParam",
  "subtitlesParam",
  "origin",
  "frameOrigins",
  "messageShape",
] as const;
export type ProviderField = (typeof PROVIDER_FIELDS)[number];

export interface ProviderRefusal {
  readonly field: ProviderField;
  readonly sentence: string;
}

const first = (checks: ReadonlyArray<readonly [ProviderField, Refusal]>): ProviderRefusal | null => {
  const found = checks.find(([, sentence]) => sentence !== null);
  return found === undefined || found[1] === null ? null : { field: found[0], sentence: found[1] };
};

/** Why `Create` is disabled, in the form's order, or undefined. The Movie template is required of an embed provider. */
export function createReason(draft: NewProviderDraft, busy: boolean, unreachable: boolean): string | undefined {
  const template = showsTemplates(draft.family) ? required("Movie template", draft.movieTemplate) : null;
  return (
    required("Name", draft.name) ??
    required("Source", draft.source) ??
    template ??
    (busy ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined)
  );
}

/** The first value the New form refuses when `Create` is pressed, in the form's order, or null. */
export function firstCreateRefusal(draft: NewProviderDraft): ProviderRefusal | null {
  return first([
    ["name", tooLong("Name", draft.name, NAME_MAX)],
    ["source", tooLong("Source", draft.source, SOURCE_MAX)],
    [
      "movieTemplate",
      showsTemplates(draft.family) ? templateRefusal("Movie template", draft.movieTemplate, MOVIE_PLACEHOLDERS) : null,
    ],
  ]);
}

/** Why `Save` is disabled by a required field, or undefined. */
export function saveRequiredReason(draft: ProviderDraft): string | undefined {
  const template = showsTemplates(draft.family) ? required("Movie template", draft.movieTemplate) : null;
  return required("Name", draft.name) ?? required("Source", draft.source) ?? template ?? undefined;
}

/** The first value the workspace refuses when `Save` is pressed, in the page's order, or null. */
export function firstSaveRefusal(draft: ProviderDraft): ProviderRefusal | null {
  const embed = showsTemplates(draft.family);
  return first([
    ["name", required("Name", draft.name) ?? tooLong("Name", draft.name, NAME_MAX)],
    ["source", required("Source", draft.source) ?? tooLong("Source", draft.source, SOURCE_MAX)],
    ["movieTemplate", embed ? templateRefusal("Movie template", draft.movieTemplate, MOVIE_PLACEHOLDERS) : null],
    [
      "episodeTemplate",
      embed ? templateRefusal("Episode template", draft.episodeTemplate, EPISODE_PLACEHOLDERS) : null,
    ],
    ["startParam", tooLong("Start parameter", draft.startParam, PARAM_MAX)],
    ["subtitlesParam", tooLong("Subtitle parameter", draft.subtitlesParam, PARAM_MAX)],
    ["origin", originRefusal(draft.origin)],
    ["frameOrigins", frameOriginsRefusal(draft.frameOrigins)],
  ]);
}

/** A backend refusal's field (`frameOrigins.2`, `enabled`) as the row it sits under. */
export function providerFieldOf(field: string | undefined): ProviderField | undefined {
  const head = field?.split(".")[0];
  return PROVIDER_FIELDS.find((one) => one === head);
}
