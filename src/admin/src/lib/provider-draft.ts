import type { AdminProvider, MessageShape, ProviderFamily } from "@/services/schemas/provider-schema";

/* The Providers forms' values (`37` sections 3.2 and 3.3), pure. A draft holds what the fields hold (strings for text, a
 * number for Order, a list for the frame origins), and is compared with the saved provider's draft, so `dirty` is a fact
 * about values and never a flag set by typing. Name comes first on every form (owner, 2026-10-17). */

/** The New provider form, in its rows' order. */
export interface NewProviderDraft {
  readonly name: string;
  readonly family: ProviderFamily;
  readonly source: string;
  readonly movieTemplate: string;
}

export const EMPTY_NEW_PROVIDER: NewProviderDraft = { name: "", family: "embed", source: "", movieTemplate: "" };

export const sameNewProvider = (a: NewProviderDraft, b: NewProviderDraft): boolean =>
  a.name === b.name && a.family === b.family && a.source === b.source && a.movieTemplate === b.movieTemplate;

/** The workspace: Details, Templates and Player. `enabled` is the stored `is_active`; an absent text is "", an absent
 *  message shape "" (None). */
export interface ProviderDraft {
  readonly name: string;
  readonly family: ProviderFamily;
  readonly source: string;
  readonly movieTemplate: string;
  readonly enabled: boolean;
  readonly order: number;
  readonly episodeTemplate: string;
  readonly startParam: string;
  readonly subtitlesParam: string;
  readonly origin: string;
  readonly frameOrigins: readonly string[];
  readonly messageShape: MessageShape | "";
}

export function draftOfProvider(provider: AdminProvider): ProviderDraft {
  return {
    name: provider.name,
    family: provider.family,
    source: provider.source,
    movieTemplate: provider.movieTemplate ?? "",
    enabled: provider.is_active,
    order: provider.order,
    episodeTemplate: provider.episodeTemplate ?? "",
    startParam: provider.startParam ?? "",
    subtitlesParam: provider.subtitlesParam ?? "",
    origin: provider.origin ?? "",
    frameOrigins: provider.frameOrigins ?? [],
    messageShape: provider.messageShape ?? "",
  };
}

export const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const TEXT_KEYS = [
  "name",
  "source",
  "movieTemplate",
  "episodeTemplate",
  "startParam",
  "subtitlesParam",
  "origin",
] as const satisfies ReadonlyArray<keyof ProviderDraft>;

export function sameProviderDraft(a: ProviderDraft, b: ProviderDraft): boolean {
  return (
    TEXT_KEYS.every((key) => a[key] === b[key]) &&
    a.family === b.family &&
    a.enabled === b.enabled &&
    a.order === b.order &&
    a.messageShape === b.messageShape &&
    sameList(a.frameOrigins, b.frameOrigins)
  );
}

/** An embed provider shows the template rows; a stream provider does not (`37` section 3.2). */
export const showsTemplates = (family: ProviderFamily): boolean => family === "embed";
