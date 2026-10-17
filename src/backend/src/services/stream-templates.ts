import { isAcceptedAddress } from "./address-rule.js";
import { asRecord } from "./title-shapes.js";

/**
 * The stream-address rule of docs/03 section 7.5: `MOVIE_STREAM_TEMPLATE` is an address in which
 * `{tmdbId}` is replaced; `EPISODE_STREAM_TEMPLATE` one in which `{tmdbId}`, `{season}` and
 * `{episode}` are. The backend fills them on every movie detail and episode it answers; a template
 * that is not set, or whose filled address fails the address rule (7.3), leaves `streamUrl` absent.
 */
export function createStreamTemplates(options: {
  movieTemplate: string;
  episodeTemplate: string;
  allowLoopback: boolean;
}) {
  const { movieTemplate, episodeTemplate, allowLoopback } = options;

  function filled(template: string, values: { tmdbId: number; season?: number; episode?: number }): string | undefined {
    if (template === "") return undefined;
    const url = template.replace(/\{(\w+)\}/g, (placeholder: string) => {
      const value = values[placeholder.slice(1, -1) as keyof typeof values];
      return value === undefined ? placeholder : String(value);
    });
    return isAcceptedAddress(url, allowLoopback) ? url : undefined;
  }

  const movieStreamUrl = (tmdbId: number): string | undefined => filled(movieTemplate, { tmdbId });

  const episodeStreamUrl = (tmdbId: number, season: number, episode: number): string | undefined =>
    filled(episodeTemplate, { tmdbId, season, episode });

  /** A movie detail carries its stream address; a series detail answers no episode address. */
  const withDetail = (answer: Record<string, unknown>): Record<string, unknown> => {
    const tmdbId = answer.tmdbId;
    if (answer.kind !== "movie" || typeof tmdbId !== "number") return answer;
    const streamUrl = movieStreamUrl(tmdbId);
    return streamUrl !== undefined ? { ...answer, streamUrl } : answer;
  };

  const withEpisodes = (answer: { episodes: unknown[] }, tmdbId: number): { episodes: unknown[] } => ({
    episodes: answer.episodes.map((entry) => {
      const row = asRecord(entry);
      const season = row.season;
      const episode = row.episode;
      if (typeof season !== "number" || typeof episode !== "number") return entry;
      const streamUrl = episodeStreamUrl(tmdbId, season, episode);
      return streamUrl !== undefined ? { ...row, streamUrl } : entry;
    }),
  });

  return { movieStreamUrl, episodeStreamUrl, withDetail, withEpisodes };
}

export type StreamTemplates = ReturnType<typeof createStreamTemplates>;
