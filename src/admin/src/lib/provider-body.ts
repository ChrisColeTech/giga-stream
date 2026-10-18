import type { AdminProvider } from "@/services/schemas/provider-schema";
import { draftOfProvider, sameList, showsTemplates, type NewProviderDraft, type ProviderDraft } from "./provider-draft";

/* The request bodies of the Providers routes (`37` section 3.1), pure. A create sends the New form's fields, trimmed as
 * the backend trims them. A save is a `PUT` with partial semantics: it sends ONLY the fields that differ from the saved
 * provider (absent keeps), and a field the person emptied is sent as `null`, which clears it. */

export type ProviderBody = Readonly<Record<string, unknown>>;

export function providerCreateBody(draft: NewProviderDraft): ProviderBody {
  const template = draft.movieTemplate.trim();
  return {
    name: draft.name.trim(),
    source: draft.source.trim(),
    family: draft.family,
    ...(showsTemplates(draft.family) && template !== "" && { movieTemplate: template }),
  };
}

const OPTIONAL_TEXT = [
  "movieTemplate",
  "episodeTemplate",
  "startParam",
  "subtitlesParam",
  "origin",
] as const satisfies ReadonlyArray<keyof ProviderDraft>;

/** The `PUT` body: the changed fields only; an emptied optional text, an empty frame-origin list and the message shape
 *  None are `null`. Name and Source are required, so they are only ever sent as values. */
export function providerChanges(saved: AdminProvider, draft: ProviderDraft): ProviderBody {
  const before = draftOfProvider(saved);
  const body: Record<string, unknown> = {};
  for (const key of ["name", "source"] as const) {
    const value = draft[key].trim();
    if (value !== before[key]) body[key] = value;
  }
  if (draft.family !== before.family) body["family"] = draft.family;
  if (draft.enabled !== before.enabled) body["enabled"] = draft.enabled;
  if (draft.order !== before.order) body["order"] = draft.order;
  for (const key of OPTIONAL_TEXT) {
    const value = draft[key].trim();
    if (value !== before[key]) body[key] = value === "" ? null : value;
  }
  if (!sameList(draft.frameOrigins, before.frameOrigins)) {
    body["frameOrigins"] = draft.frameOrigins.length === 0 ? null : [...draft.frameOrigins];
  }
  if (draft.messageShape !== before.messageShape) {
    body["messageShape"] = draft.messageShape === "" ? null : draft.messageShape;
  }
  return body;
}

export const isEmptyBody = (body: ProviderBody): boolean => Object.keys(body).length === 0;
