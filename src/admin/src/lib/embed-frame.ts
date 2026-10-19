import type { AdminProvider } from "@/services/schemas/provider-schema";

/* The admin's embed lib (`55` decisions 7 and 8): the backend's fill rule mirrored (`src/backend/src/services/
 * title-sources.ts`) so a preview window builds a provider's address exactly as the backend builds a title's sources,
 * and the frame rules the interface's embed host follows (`src/frontend/src/components/player/EmbedHost.tsx`). Pure. */

/** The permissions a provider frame allows. A provider iframe has NO `sandbox` attribute (owner, 2026-10-17). */
export const EMBED_ALLOW = "autoplay; fullscreen; encrypted-media; picture-in-picture";

export const EMBED_REFERRER = "origin" as const;

/** What a preview frame plays: the address it loads, and the exact origins the window's player policy allows while it is
 *  open (`55` decision 9: the preload's `setPlayerPolicy({ origin, frameOrigins })`). */
export interface EmbedTarget {
  readonly address: string;
  readonly origin: string;
  readonly frameOrigins: readonly string[];
}

export interface TemplateValues {
  readonly tmdbId?: number;
  readonly season?: number;
  readonly episode?: number;
}

/** The backend's fill rule, mirrored: `{tmdbId}`, `{season}` and `{episode}` only; a placeholder with no value for the
 *  kind stays as it is. */
export function fillTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(tmdbId|season|episode)\}/g, (placeholder: string) => {
    const key = placeholder.slice(1, -1) as keyof TemplateValues;
    const value = values[key];
    return value === undefined ? placeholder : String(value);
  });
}

/** The address's own origin, or null when it does not parse. */
function ownOrigin(address: string): string | null {
  try {
    return new URL(address).origin;
  } catch {
    return null;
  }
}

export type TemplateProvider = Pick<AdminProvider, "family" | "movieTemplate" | "origin" | "frameOrigins">;

/** One movie's embed target from the provider's template: the filled address with the origin its policy allows - the
 *  provider's own, or the address's when it has none, exactly the backend's `sourceOf` rule. Null when there is nothing
 *  to embed: a stream-family provider, a missing template or TMDB id, or a filled address that is not https. */
export function embedTargetOf(provider: TemplateProvider, tmdbId: number | undefined): EmbedTarget | null {
  if (provider.family !== "embed" || provider.movieTemplate === undefined || tmdbId === undefined) return null;
  const address = fillTemplate(provider.movieTemplate, { tmdbId });
  if (!address.startsWith("https://")) return null;
  const origin = provider.origin === undefined ? ownOrigin(address) : provider.origin;
  return origin === null ? null : { address, origin, frameOrigins: provider.frameOrigins ?? [] };
}

/** Blanks the frame so picture and sound stop at once (`55` decision 7: `src="about:blank"` to stop): the DOM node's
 *  owner (React, via the stage's key) removes it; an `about:blank` navigation is always allowed by the frame guard. */
export function stopEmbedFrame(frame: { src: string } | null | undefined): void {
  if (frame !== null && frame !== undefined) frame.src = "about:blank";
}