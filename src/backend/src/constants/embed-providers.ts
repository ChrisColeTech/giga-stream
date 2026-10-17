import type { SeedProvider } from "../types/provider.js";

/**
 * The embed catalog the seeder seeds (docs/03 section 7.2b, docs/18 section 2): VidSrc, VixSrc and
 * VidZee verbatim from the PoC's proven records (`14`), then every other host of docs/18 section 2's
 * table in its order. Movie templates are the live addresses that table captured, with https://
 * prefixed; an episode template mirrors its host's movie path with tv — the documented shape on
 * VidLink, VidFast, VidSrc.su, VidCore, VidLove, VidZee and VixSrc (`12`). Hosts with no documented
 * parameters carry none.
 */
export const EMBED_PROVIDER_CATALOG: SeedProvider[] = [
  {
    name: "VidSrc", source: "vidsrc", order: 1, family: "embed",
    movieTemplate: "https://vidsrc.sh/embed/movie/{tmdbId}",
    episodeTemplate: "https://vidsrc.sh/embed/tv/{tmdbId}/{season}/{episode}",
    startParam: "startAt", subtitlesParam: "ds_lang",
    origin: "https://vidsrc.sh", frameOrigins: ["https://vidsrc.sh"], messageShape: "vidsrc-status",
  },
  {
    name: "VixSrc", source: "vixsrc", order: 2, family: "embed",
    movieTemplate: "https://vixsrc.to/movie/{tmdbId}",
    episodeTemplate: "https://vixsrc.to/tv/{tmdbId}/{season}/{episode}",
    startParam: "startAt",
    origin: "https://vixsrc.to", frameOrigins: ["https://vixsrc.to"], messageShape: "player-event",
  },
  {
    name: "VidZee", source: "vidzee", order: 3, family: "embed",
    movieTemplate: "https://player.vidzee.wtf/embed/movie/{tmdbId}",
    episodeTemplate: "https://player.vidzee.wtf/embed/tv/{tmdbId}/{season}/{episode}",
    origin: "https://player.vidzee.wtf", frameOrigins: ["https://player.vidzee.wtf"], messageShape: "player-event",
  },
  {
    // Order 0: the owner's default source for movies and TV (owner, 2026-10-17) — the first source
    // by preference order, which every title's answer and the Player's default pick follow.
    name: "Cinezo", source: "cinezo", order: 0, family: "embed",
    movieTemplate: "https://player.cinezo.live/embed/movie/{tmdbId}",
    episodeTemplate: "https://player.cinezo.live/embed/tv/{tmdbId}/{season}/{episode}",
  },
  {
    // Docs 18 section 3.12: parameter shapes unknown, embed path from the tracker.
    name: "CineSrc", source: "cinesrc", order: 5, family: "embed",
    movieTemplate: "https://cinesrc.st/embed/movie/{tmdbId}",
    episodeTemplate: "https://cinesrc.st/embed/tv/{tmdbId}/{season}/{episode}", // presumed: not verified
  },
  {
    // TV presumed: docs 18 marks PeeStream's TV shape unverified (&type=tv&s=&e=).
    name: "PeeStream", source: "peestream", order: 6, family: "embed",
    movieTemplate: "https://peestream.in/embed/?tmdbId={tmdbId}&type=movie",
    episodeTemplate: "https://peestream.in/embed/?tmdbId={tmdbId}&type=tv&s={season}&e={episode}",
  },
  {
    name: "FlaxMovies", source: "flaxmovies", order: 7, family: "embed",
    movieTemplate: "https://flaxmovies.xyz/embed/movie/{tmdbId}",
    episodeTemplate: "https://flaxmovies.xyz/embed/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "MoviesAPI", source: "moviesapi", order: 8, family: "embed",
    movieTemplate: "https://moviesapi.to/movie/{tmdbId}",
    episodeTemplate: "https://moviesapi.to/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "VidLink", source: "vidlink", order: 9, family: "embed",
    movieTemplate: "https://vidlink.pro/movie/{tmdbId}",
    episodeTemplate: "https://vidlink.pro/tv/{tmdbId}/{season}/{episode}",
    startParam: "startAt",
  },
  {
    // No templates: its movie address wants an IMDb id ({imdbId},
    // vidsrc-embed.ru/embed/movie/{imdbId}), which the backend does not have.
    name: "VidSrc Embed", source: "vidsrc-embed", order: 10, family: "embed",
  },
  {
    // TV presumed: docs 18 section 3.11 records VidEasy's shapes as not verified live.
    name: "VidEasy", source: "videasy-embed", order: 11, family: "embed",
    movieTemplate: "https://player.videasy.net/movie/{tmdbId}",
    episodeTemplate: "https://player.videasy.net/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "111Movies", source: "111movies", order: 12, family: "embed",
    movieTemplate: "https://111movies.com/movie/{tmdbId}",
    episodeTemplate: "https://111movies.com/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "2Embed", source: "2embed", order: 13, family: "embed",
    movieTemplate: "https://www.2embed.cc/embed/{tmdbId}",
    episodeTemplate: "https://www.2embed.cc/embedtv/{tmdbId}&s={season}&e={episode}",
  },
  {
    // No templates: a watch page (mapple.uk/watch/movie/{tmdbId}), not a bare embed host.
    name: "Mapple", source: "mapple", order: 14, family: "embed",
  },
  {
    // TV presumed: docs 18 marks PrimeSrc's TV shape unverified.
    name: "PrimeSrc", source: "primesrc", order: 15, family: "embed",
    movieTemplate: "https://primesrc.me/embed/movie?tmdb={tmdbId}",
    episodeTemplate: "https://primesrc.me/embed/tv?tmdb={tmdbId}&s={season}&e={episode}",
  },
  {
    // TV presumed: the &s=&e= shape is recorded (18 section 3.8) but awaits a TV-title pass.
    name: "MultiEmbed", source: "multiembed", order: 16, family: "embed",
    movieTemplate: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1",
    episodeTemplate: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1&s={season}&e={episode}",
  },
  {
    name: "AutoEmbed", source: "autoembed", order: 17, family: "embed",
    movieTemplate: "https://player.autoembed.cc/embed/movie/{tmdbId}",
    episodeTemplate: "https://player.autoembed.cc/embed/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "VidLove", source: "vidlove", order: 18, family: "embed",
    movieTemplate: "https://player.vidlove.cc/embed/movie/{tmdbId}",
    episodeTemplate: "https://player.vidlove.cc/embed/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "VidFast", source: "vidfast", order: 19, family: "embed",
    movieTemplate: "https://vidfast.vc/movie/{tmdbId}",
    episodeTemplate: "https://vidfast.vc/tv/{tmdbId}/{season}/{episode}",
    startParam: "startAt", subtitlesParam: "sub",
  },
  {
    name: "Filmu", source: "filmu", order: 20, family: "embed",
    movieTemplate: "https://embed.filmu.in/movie/{tmdbId}",
    episodeTemplate: "https://embed.filmu.in/tv/{tmdbId}/{season}/{episode}",
  },
  {
    // The docs site is vidcore.org, whose pages embed vidcore.created.app; the picker used vidcore.net.
    name: "VidCore", source: "vidcore", order: 21, family: "embed",
    movieTemplate: "https://vidcore.net/movie/{tmdbId}",
    episodeTemplate: "https://vidcore.net/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "VAPlayer", source: "vaplayer", order: 22, family: "embed",
    movieTemplate: "https://vaplayer.ru/embed/movie/{tmdbId}",
    episodeTemplate: "https://vaplayer.ru/embed/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "Vares", source: "vares", order: 23, family: "embed",
    movieTemplate: "https://vares.app/movie/{tmdbId}",
    episodeTemplate: "https://vares.app/tv/{tmdbId}/{season}/{episode}",
  },
  {
    // TV presumed: docs 18 section 3.11 records VidKing's shapes as not verified live.
    name: "VidKing", source: "vidking", order: 24, family: "embed",
    movieTemplate: "https://www.vidking.net/embed/movie/{tmdbId}",
    episodeTemplate: "https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "VidNest", source: "vidnest-embed", order: 25, family: "embed",
    movieTemplate: "https://vidnest.fun/movie/{tmdbId}",
    episodeTemplate: "https://vidnest.fun/tv/{tmdbId}/{season}/{episode}",
  },
  {
    // Posts MEDIA_DATA (18 section 3.1), which is neither supported message shape.
    name: "VidSrc.su", source: "vidsrc-su", order: 26, family: "embed",
    movieTemplate: "https://vidsrc.su/movie/{tmdbId}",
    episodeTemplate: "https://vidsrc.su/tv/{tmdbId}/{season}/{episode}",
  },
  {
    name: "VidGod", source: "vidgod", order: 27, family: "embed",
    movieTemplate: "https://vidgod.net/movie/{tmdbId}",
    episodeTemplate: "https://vidgod.net/tv/{tmdbId}/{season}/{episode}",
  },
  {
    // TV presumed: the live movie address is query-style; its docs page shows the path style (18 section 3.9).
    name: "VidSrc.me", source: "vidsrc-me", order: 28, family: "embed",
    movieTemplate: "https://vidsrc.me/embed/movie?tmdb={tmdbId}",
    episodeTemplate: "https://vidsrc.me/embed/tv?tmdb={tmdbId}&s={season}&e={episode}",
  },
  {
    name: "1Embed", source: "1embed", order: 29, family: "embed",
    movieTemplate: "https://1embed.cc/embed/movie/{tmdbId}",
    episodeTemplate: "https://1embed.cc/embed/tv/{tmdbId}/{season}/{episode}",
  },
];
