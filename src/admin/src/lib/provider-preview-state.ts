import type { AdminProvider } from "@/services/schemas/provider-schema";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { FAILED_WORD, MISSING_WORD, NO_TITLE_WORD, READY_WORD, READING_WORD } from "@/constants/preview-copy";
import { embedTargetOf, type EmbedTarget } from "./embed-frame";

/* The provider preview window's own state (`55` decision 7), pure: which stored titles the `Title` select offers, which
 *  one it shows, what the frame plays, and the one word its status bar says. The list's own order stands (the Stored
 *  list reads title-ascending by default). */

/** A title the select can offer: a stored movie with a TMDB id, the only kind a movie template can fill. */
export const previewTitleRows = (rows: readonly AdminTitleRow[]): readonly AdminTitleRow[] =>
  rows.filter((row) => row.kind === "movie" && row.tmdbId !== undefined);

/** The window's first choice (`55` decision 7): the first stored movie with a TMDB id in the list's own order. */
export const defaultPreviewTitle = (rows: readonly AdminTitleRow[]): AdminTitleRow | undefined =>
  previewTitleRows(rows)[0];

/** The row the window shows: the one chosen while it is still held, else the default. */
export function resolvePreviewTitle(
  rows: readonly AdminTitleRow[],
  chosen: string | null,
): AdminTitleRow | undefined {
  if (chosen !== null) {
    const held = rows.find((row) => row.id === chosen);
    if (held !== undefined && held.kind === "movie" && held.tmdbId !== undefined) return held;
  }
  return defaultPreviewTitle(rows);
}

/** What the provider preview frame plays: the provider's movie template filled with the chosen title's TMDB id. */
export const providerPreviewTarget = (
  provider: AdminProvider | undefined,
  title: AdminTitleRow | undefined,
): EmbedTarget | null => (provider === undefined || title === undefined ? null : embedTargetOf(provider, title.tmdbId));

/** The window's status bar word: the honest state of the frame, never a sentence. */
export function providerPreviewWord(
  provider: AdminProvider | undefined,
  reading: boolean,
  failed: boolean,
  target: EmbedTarget | null,
): string {
  if (provider === undefined) return MISSING_WORD;
  if (reading) return READING_WORD;
  if (failed) return FAILED_WORD;
  return target === null ? NO_TITLE_WORD : READY_WORD;
}