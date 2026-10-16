// The providers under test (data/providers.json) and the addresses built from their templates.

let providers = [];

export async function loadProviders() {
  const response = await fetch('data/providers.json');
  if (!response.ok) throw new Error(`providers.json: ${response.status}`);
  providers = (await response.json()).providers;
  return providers;
}

export const allProviders = () => providers;
export const findProvider = (id) => providers.find((p) => p.id === id);

/** IMDb ids for the PoC's test titles; hosts like VidSrc Embed require them (docs/18). */
const IMDB_IDS = { '603': 'tt0133093', '1399': 'tt0944947' };

function fill(template, selection) {
  const values = { ...selection, imdbId: IMDB_IDS[selection.tmdbId] ?? '' };
  return template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(values[key] ?? ''));
}

/** The embed address for a selection, with the provider's documented parameters added. */
export function embedUrl(provider, selection) {
  const template = selection.kind === 'movie' ? provider.movie : provider.episode;
  const url = new URL(fill(template, selection));
  const start = Number(selection.startAt);
  if (provider.params?.startAt && start > 0) url.searchParams.set(provider.params.startAt, String(start));
  if (provider.params?.subtitles && selection.subtitles) url.searchParams.set(provider.params.subtitles, selection.subtitles);
  return url.href;
}

/** The provider's documented availability address for a selection, or null. */
export function availabilityUrl(provider, selection) {
  const template = provider.availability?.[selection.kind];
  return template ? fill(template, selection) : null;
}

/**
 * The playable address for a selection. Embed providers build the documented embed URL (the PoC's
 * original behaviour). Stream providers return the provider's documented stream endpoint for the
 * selection, so the PoC can fetch it and check for a playable address.
 */
export function resolveUrl(provider, selection) {
  const template = selection.kind === 'movie' ? provider.movie : provider.episode;
  if (!template) return null;
  return fill(template, selection);
}

export function describe(selection) {
  return selection.kind === 'movie'
    ? `movie ${selection.tmdbId}`
    : `tv ${selection.tmdbId} S${String(selection.season).padStart(2, '0')}E${String(selection.episode).padStart(2, '0')}`;
}
