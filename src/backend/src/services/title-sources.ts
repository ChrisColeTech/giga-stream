import type { Store } from "../store/store.js";
import { asRecord } from "./title-shapes.js";
import type { BackendProvider, TitleSource } from "../types/provider.js";

type FillValues = { tmdbId: number; season?: number; episode?: number };

/** Fills a template's placeholders; a placeholder with no value for the kind stays as it is. */
function fill(template: string, values: FillValues): string {
  return template.replace(/\{(tmdbId|season|episode)\}/g, (placeholder: string) => {
    const key = placeholder.slice(1, -1) as keyof FillValues;
    const value = values[key];
    return value === undefined ? placeholder : String(value);
  });
}

/** One source (docs/03 section 7.5). An originless provider's embed page speaks for itself. */
function sourceOf(provider: BackendProvider, template: string, values: FillValues): TitleSource | undefined {
  const url = fill(template, values);
  if (!url.startsWith("https://")) return undefined;
  let origin = provider.origin;
  if (origin === undefined) {
    try {
      origin = new URL(url).origin;
    } catch {
      return undefined;
    }
  }
  return {
    providerId: provider.id,
    name: provider.name,
    url,
    origin,
    order: provider.order,
    ...(provider.startParam !== undefined && { startParam: provider.startParam }),
    ...(provider.subtitlesParam !== undefined && { subtitlesParam: provider.subtitlesParam }),
    ...(provider.frameOrigins !== undefined && { frameOrigins: provider.frameOrigins }),
    ...(provider.messageShape !== undefined && { messageShape: provider.messageShape }),
  };
}

/**
 * The sources fill (docs/03 sections 3.6 and 7.5): every active embed provider whose template applies
 * yields one source for the exact title or episode.
 */
export function createTitleSources(store: Store) {
  const embeds = (): BackendProvider[] =>
    store.providers
      .list()
      .filter((p) => p.is_active && p.family === "embed")
      .sort((a, b) => a.order - b.order || a.id - b.id);

  function collect(values: FillValues, templateOf: (p: BackendProvider) => string | undefined): TitleSource[] {
    const sources: TitleSource[] = [];
    for (const provider of embeds()) {
      const template = templateOf(provider);
      if (template === undefined) continue;
      const source = sourceOf(provider, template, values);
      if (source !== undefined) sources.push(source);
    }
    return sources;
  }

  const forMovie = (tmdbId: number): TitleSource[] =>
    collect({ tmdbId }, (p) => p.movieTemplate);

  const forEpisode = (tmdbId: number, season: number, episode: number): TitleSource[] =>
    collect({ tmdbId, season, episode }, (p) => p.episodeTemplate);

  /**
   * A movie detail carries its sources; a series detail carries none — 7.5 names a movie and an
   * episode, and a series has no season and episode to fill an episode template with.
   */
  const withDetail = (answer: Record<string, unknown>): Record<string, unknown> => {
    const tmdbId = answer.tmdbId;
    if (answer.kind !== "movie" || typeof tmdbId !== "number") return answer;
    const sources = forMovie(tmdbId);
    return sources.length > 0 ? { ...answer, sources } : answer;
  };

  const withEpisodes = (answer: { episodes: unknown[] }, tmdbId: number): { episodes: unknown[] } => ({
    episodes: answer.episodes.map((entry) => {
      const row = asRecord(entry);
      const season = row.season;
      const episode = row.episode;
      if (typeof season !== "number" || typeof episode !== "number") return entry;
      const sources = forEpisode(tmdbId, season, episode);
      return sources.length > 0 ? { ...row, sources } : entry;
    }),
  });

  return { forMovie, forEpisode, withDetail, withEpisodes };
}

export type TitleSources = ReturnType<typeof createTitleSources>;
