import type { TitleSource } from "../types/library.js";
import type { Provider, ProviderClient } from "./provider-client.js";

type Values = { tmdbId: number; season?: number; episode?: number };

function sourceOf(provider: Provider, template: string, values: Values): TitleSource | undefined {
  const url = template.replace(/\{(tmdbId|season|episode)\}/g, (placeholder) => {
    const key = placeholder.slice(1, -1) as keyof Values;
    return values[key] === undefined ? placeholder : String(values[key]);
  });
  if (!url.startsWith("https://")) return undefined;
  let origin = provider.origin;
  try { origin ??= new URL(url).origin; } catch { return undefined; }
  return {
    providerId: provider.id, name: provider.name, url, origin, order: provider.order,
    ...(provider.startParam !== undefined && { startParam: provider.startParam }),
    ...(provider.subtitlesParam !== undefined && { subtitlesParam: provider.subtitlesParam }),
    ...(provider.frameOrigins !== undefined && { frameOrigins: provider.frameOrigins }),
    ...(provider.messageShape !== undefined && { messageShape: provider.messageShape }),
  };
}

/** Request-local source generation; provider records and generated sources are never persisted. */
export function createTitleSources(client: ProviderClient, adminUrl: () => string) {
  async function collect(values: Values, template: (provider: Provider) => string | undefined): Promise<TitleSource[]> {
    const answer = await client.list(adminUrl());
    if (!answer.ok) return [];
    return answer.value
      .filter((provider) => provider.is_active && provider.family === "embed")
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .flatMap((provider) => {
        const pattern = template(provider);
        const source = pattern === undefined ? undefined : sourceOf(provider, pattern, values);
        return source === undefined ? [] : [source];
      });
  }
  return {
    movie: (tmdbId: number) => collect({ tmdbId }, (provider) => provider.movieTemplate),
    episode: (tmdbId: number, season: number, episode: number) =>
      collect({ tmdbId, season, episode }, (provider) => provider.episodeTemplate),
  };
}

export type TitleSources = ReturnType<typeof createTitleSources>;
