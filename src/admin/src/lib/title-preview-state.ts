import { FAILED_WORD, MISSING_WORD, NO_SOURCE_WORD, READY_WORD, READING_WORD } from "@/constants/preview-copy";
import { SourceSchema, type AdminTitleDetail, type TitleSource } from "@/services/schemas/title-schema";
import type { EmbedTarget } from "./embed-frame";

/* The title preview window's own state (`55` decision 8), pure: which sources the `Provider` select offers - a movie's
 *  own detail sources, or a series' first episode's - which one it shows, and the one word its status bar says. An
 *  unreadable source costs itself, never its siblings (`01` section 8). */

/** One source the select offers, narrowed from the detail's raw record. */
export interface TitleSourceView {
  /** The select's value: the provider's id when it has one, else the source's address. */
  readonly id: string;
  readonly name: string;
  readonly url: string;
  /** The source's own origin, or the address's when it carries none (the backend's own fallback). */
  readonly origin: string;
  readonly frameOrigins: readonly string[];
}

function sourceView(source: TitleSource): TitleSourceView | null {
  let origin = source.origin;
  if (origin === undefined) {
    try {
      origin = new URL(source.url).origin;
    } catch {
      return null;
    }
  }
  return {
    id: source.providerId !== undefined ? String(source.providerId) : source.url,
    name: source.name,
    url: source.url,
    origin,
    frameOrigins: source.frameOrigins ?? [],
  };
}

/** The detail's `sources` as the select's rows, in the backend's order (its providers', by preference). */
export function sourceViews(sources: readonly unknown[]): readonly TitleSourceView[] {
  const views: TitleSourceView[] = [];
  for (const source of sources) {
    const parsed = SourceSchema.safeParse(source);
    if (parsed.success) {
      const view = sourceView(parsed.data);
      if (view !== null) views.push(view);
    }
  }
  return views;
}

/** A series' first episode's sources, from the existing seasons read's answer (`55` decision 8): the first episode that
 *  carries any, in the season's own order. */
export function episodeSourceViews(episodes: readonly unknown[]): readonly TitleSourceView[] {
  for (const episode of episodes) {
    if (typeof episode !== "object" || episode === null || Array.isArray(episode)) continue;
    if (!("sources" in episode) || !Array.isArray(episode.sources)) continue;
    const views = sourceViews(episode.sources);
    if (views.length > 0) return views;
  }
  return [];
}

/** The season the window reads for a series: the first of the detail's own list, season 1 when it names none. */
export const firstSeasonOf = (detail: Pick<AdminTitleDetail, "seasons">): number => detail.seasons?.[0]?.season ?? 1;

/** The window's first choice: the first source in the backend's order. */
export const defaultPreviewSource = (sources: readonly TitleSourceView[]): TitleSourceView | undefined => sources[0];

/** The source the window shows: the one chosen while it is still offered, else the default. */
export function resolvePreviewSource(
  sources: readonly TitleSourceView[],
  chosen: string | null,
): TitleSourceView | undefined {
  if (chosen !== null) {
    const held = sources.find((source) => source.id === chosen);
    if (held !== undefined) return held;
  }
  return defaultPreviewSource(sources);
}

/** What the title preview frame plays: the chosen source's own address, and the origins its policy allows. */
export function titlePreviewTarget(source: TitleSourceView | undefined): EmbedTarget | null {
  return source === undefined ? null : { address: source.url, origin: source.origin, frameOrigins: source.frameOrigins };
}

/** The window's status bar word: the honest state of the frame, never a sentence. `gone` is a failed detail read. */
export function titlePreviewWord(gone: boolean, reading: boolean, failed: boolean, sources: readonly unknown[]): string {
  if (gone) return MISSING_WORD;
  if (reading) return READING_WORD;
  if (failed) return FAILED_WORD;
  return sources.length === 0 ? NO_SOURCE_WORD : READY_WORD;
}