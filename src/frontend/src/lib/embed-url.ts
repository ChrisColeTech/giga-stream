import type { TitleSource } from "@/services/schemas/source-schema";

export function embedUrl(
  source: TitleSource,
  positionMs: number,
  subtitleLanguage: string | null,
): string {
  const url = new URL(source.url);
  if (source.startParam !== undefined && positionMs > 0) {
    url.searchParams.set(source.startParam, String(Math.floor(positionMs / 1000)));
  }
  if (source.subtitlesParam !== undefined && subtitleLanguage !== null) {
    url.searchParams.set(source.subtitlesParam, subtitleLanguage);
  }
  return url.toString();
}
