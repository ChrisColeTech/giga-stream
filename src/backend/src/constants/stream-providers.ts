import type { SeedProvider } from "../types/provider.js";

/**
 * The stream-family rows the seeder seeds (docs/03 sections 7.2b and 7.5): each with its own `source`
 * value — the ids the PoC's CinePro records carry (`14`), which the sources fill tells apart — and no
 * templates: a stream provider produces no source until one is proven playable without a resolve step.
 */
export const STREAM_PROVIDER_CATALOG: SeedProvider[] = [
  { name: "VidApi", source: "vidapi", order: 0, family: "stream" },
  { name: "VidRock", source: "vidrock", order: 0, family: "stream" },
  { name: "Icefy", source: "icefy", order: 0, family: "stream" },
  { name: "Peachify", source: "peachify", order: 0, family: "stream" },
  { name: "Popr", source: "popr", order: 0, family: "stream" },
  { name: "MafiaEmbed", source: "streammafia", order: 0, family: "stream" },
  { name: "Tulnex", source: "tulnex", order: 0, family: "stream" },
  { name: "CineSu", source: "cinesu", order: 0, family: "stream" },
  { name: "FshareTV", source: "fsharetv", order: 0, family: "stream" },
  { name: "Videasy", source: "videasy", order: 0, family: "stream" },
  { name: "VidNest", source: "vidnest", order: 0, family: "stream" },
];
