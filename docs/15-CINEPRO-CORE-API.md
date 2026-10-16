# 15 - CinePro Core API Reference

**Status: extracted from `D:\Projects\core-main` (the CinePro Core repository) and
`@omss/framework@1.1.24` on 2026-10-16.** CinePro Core is a self-hosted, OMSS-compliant
scraping/streaming server. This document records its HTTP API, data shapes, proxy model, and
**every provider's upstream request/response contract** so Giga Stream can integrate against it
and so the provider logic can be reimplemented or debugged. Nothing here is an assumption: every
endpoint, field, and default was read from the repository's source or from the framework package
that implements the routes.

CinePro Core resolves movie and TV episode stream sources by fanning out to ~17 providers
concurrently, each of which may fan out to many upstream servers, deduplicating the results, and
serving everything through its own proxy so the client never talks to the upstreams directly. It
also exposes an optional Stremio addon (`STREMIO_ADDON=true`) and an optional MCP endpoint for AI
agents (`MCP_ENABLED=true`).

---

## 1. Where it fits in Giga Stream

- CinePro Core is an **optional backend** that Giga Stream's server can query for provider
  sources. It is not part of the live-stream pipeline (`10`); it is the "titles" side of the
  product (`12`, `13`).
- It answers "where can I play this TMDB id" and returns playable addresses. Giga Stream's own
  metadata still comes from TMDB (`11`); CinePro only supplies the streams.
- Every address it returns is a proxy URL pointing back at CinePro (section 5), so the browser
  or player fetches media through the CinePro instance, not through the scraper's upstreams.
- The "50+ unique sources per title" claim is a **source count**, not a provider count. Five of
  the seventeen providers fan out to 6–14 upstream servers each (section 9.3), producing 54
  upstream lookups alone, before multi-language dubs and dedup.

## 2. Server configuration

Built on Fastify. Runtime options come from the `OMSSConfig` object (see `server.ts`) and, at
deployment time, from environment variables:

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Listen port. |
| `HOST` | `localhost` | Bind address; `0.0.0.0` for LAN/internet. |
| `NODE_ENV` | `development` | `development` logs verbosely; `production` keeps console clean. |
| `PUBLIC_URL` | none | Public base URL of the instance (no trailing slash). Used to build absolute proxy URLs behind a reverse proxy/domain. |
| `STREMIO_ADDON` | `false` | `true` enables the Stremio addon at `/stremio/manifest.json`. |
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s). |
| `MCP_ENABLED` | `false` | `true` enables the MCP JSON-RPC endpoint (default path `/mcp`). |
| `INTERNAL_DEBUG` | `false` | `true` also returns non-playable sources. |
| `TMDB_API_KEY` | (required) | TMDB API key. Server refuses to start without it. |
| `TMDB_CACHE_TTL` | `86400` | TMDB metadata cache lifetime, seconds. |
| `CACHE_TYPE` | `memory` | `memory` or `redis`. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / empty | Redis connection when `CACHE_TYPE=redis`. |

Cache TTLs: sources are cached for `60*60` (1 hour) and subtitles for `60*60*24` (24 hours) by
default; TMDB metadata is cached for 24 hours. Responses also carry a fixed `expiresAt` of 2
hours ahead (section 3.5).

CORS is configured in `server.ts` with methods `GET, OPTIONS`, allowed headers
`Content-Type, Authorization`, and exposed headers `Content-Range, Accept-Ranges, ETag`.

### 2.1 `OMSSConfig` shape

```ts
interface OMSSConfig {
    name: string;
    version: string;
    port?: number;
    host?: string;
    publicUrl?: string;
    cache?: { type: 'memory' | 'redis'; redis?: { host, port, password? }; ttl?: { sources, subtitles } };
    tmdb?: { apiKey: string; cacheTTL?: number };
    proxyConfig?: { knownThirdPartyProxies: Record<string, RegExp[]>; streamPatterns: RegExp[] };
    note?: string;
    cors?: FastifyCorsOptions;
    stremio?: { enableNativeAddon: boolean; stremioAddons: StremioAddonConfig[] };
    mcp?: { enabled: boolean; path?: string };
}
```

## 3. Core HTTP API

Base URL: `http://<host>:<port>`. All JSON endpoints return `application/json`.

### 3.1 Health

`GET /` — also mounted at `/v1`, `/v1/`, and `/v1/health`.

**200** response:

```json
{
  "name": "CinePro",
  "version": "1.0.0",
  "status": "operational",
  "endpoints": {
    "movie": "/v1/movies/{id}",
    "tv": "/v1/tv/{id}/seasons/{s}/episodes/{e}",
    "proxy": "/v1/proxy?data={encoded_data}",
    "refresh": "/v1/refresh/{responseId}"
  },
  "spec": "omss",
  "note": "Running with 13 provider(s). Supported Providers: CineSu, FshareTV, Icefy, Peachify, Popr, MafiaEmbed, Tulnex, VidApi, Videasy, VidNest, VidRock, VidSrc, VidZee, VixSrc"
}
```

`status` is `operational` when at least one provider is registered, `degraded` when none are.

### 3.2 Movie sources

`GET /v1/movies/{tmdbId}`

`tmdbId` must be a number (1–20 digits). The server validates that the movie exists on TMDB and
has been released before scraping.

**200** → `SourceResponse` (section 3.5).
**400** → `INVALID_TMDB_ID` (bad, non-existent, or unreleased id).

### 3.3 TV episode sources

`GET /v1/tv/{tmdbId}/seasons/{season}/episodes/{episode}`

`season` is 0–99, `episode` is 1–9999. The server validates that the episode exists on TMDB and
has aired before scraping.

**200** → `SourceResponse` (section 3.5).
**400** → `INVALID_TMDB_ID`, `INVALID_SEASON`, or `INVALID_EPISODE`.

### 3.4 Refresh

`GET /v1/refresh/{responseId}`

Takes the `responseId` from a previous `SourceResponse` and deletes that entry from the cache so
the next sources request re-scrapes from all providers. `responseId` must match
`^[a-zA-Z0-9_-]{1,128}$`.

**200**:

```json
{ "status": "OK" }
```

**400** → `INVALID_RESPONSE_ID`. **404** → `RESPONSE_ID_NOT_FOUND` (unknown or expired). Mappings
expire after the sources cache TTL (1 hour), cleaned up hourly.

### 3.5 `SourceResponse` shape

Returned by the movie and TV endpoints:

```json
{
  "responseId": "3f7c2a1e-8b4d-4e6f-9a2c-1d0e5f6a7b8c",
  "expiresAt": "2026-10-16T12:00:00.000Z",
  "sources": [
    {
      "url": "http://localhost:3000/v1/proxy?data=%7B%22url%22%3A%22https%3A%2F%2Fcdn.upstream.example%2F2026%2F10%2F16%2Ffile%2Findex.m3u8%22%2C%22headers%22%3A%7B%22Referer%22%3A%22https%3A%2F%2Fplayer.upstream.example%2F%22%7D%7D",
      "type": "hls",
      "quality": "1080p",
      "audioTracks": [ { "label": "English", "language": "eng" } ],
      "provider": { "id": "vidsrc", "name": "VidSrc" }
    }
  ],
  "subtitles": [
    { "url": "http://localhost:3000/v1/proxy?data=%7B%22url%22%3A%22https%3A%2F%2Fsubs.example%2Fen.srt%22%7D", "label": "English", "format": "srt" }
  ],
  "diagnostics": [
    { "code": "PARTIAL_SCRAPE", "message": "Only 11 of 13 providers returned results", "field": "", "severity": "warning" }
  ]
}
```

Field notes:

| Field | Type | Notes |
|---|---|---|
| `responseId` | string (UUID) | Opaque handle for the `/v1/refresh` endpoint. |
| `expiresAt` | ISO-8601 string | Always 2 hours after the response was built. |
| `sources` | `Source[]` | Deduplicated by upstream URL (not by proxy URL). Empty only if no provider returned anything, in which case the request errors with `NO_SOURCES_AVAILABLE`. |
| `subtitles` | `Subtitle[]` | Deduplicated by upstream URL. |
| `diagnostics` | `Diagnostic[]` | Warnings and errors from individual providers plus a `PARTIAL_SCRAPE` warning when only some providers succeeded. |

`Source`:

| Field | Type | Notes |
|---|---|---|
| `url` | string | A proxy URL (section 5), never a direct upstream address. |
| `type` | `hls \| dash \| http \| mp4 \| mkv \| webm \| embed` | Inferred from the URL extension or set by the provider. |
| `quality` | string | e.g. `Auto`, `1080p`, `4K`; inferred from the filename when the provider does not set it. |
| `audioTracks` | `{ language, label }[]` | Often a single entry like `English / eng`. |
| `provider` | `{ id, name }` | Which provider produced this source. |

`Subtitle`:

| Field | Type | Notes |
|---|---|---|
| `url` | string | Subtitle file address (proxy URL). |
| `label` | string | Human-readable language name, e.g. `English`. |
| `format` | `vtt \| srt \| ass \| ssa \| ttml` | Inferred from the file extension. |

`Diagnostic`:

| Field | Type | Notes |
|---|---|---|
| `code` | `QUALITY_INFERRED \| LANGUAGE_INFERRED \| TYPE_INFERRED \| SUBTITLE_LABEL_INFERRED \| PROVIDER_ERROR \| PARTIAL_SCRAPE` | |
| `message` | string | Human-readable detail. |
| `field` | string | Usually empty. |
| `severity` | `info \| warning \| error` | |

### 3.6 Errors

All errors share one envelope:

```json
{
  "error": { "code": "NO_SOURCES_AVAILABLE", "message": "...", "details": { } },
  "traceId": "..."
}
```

`traceId` is the request id (also sent as the `x-request-id` header). Error codes and statuses:

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_TMDB_ID` | 400 | Bad, missing, non-existent, or unreleased TMDB id. |
| `INVALID_PARAMETER` | 400 | Malformed path/query parameter. |
| `MISSING_PARAMETER` | 400 | A required parameter is absent. |
| `INVALID_SEASON` | 400 | Season out of range (0–99) or episode does not exist/have aired. |
| `INVALID_EPISODE` | 400 | Episode out of range (1–9999) or does not exist/have aired. |
| `INVALID_RESPONSE_ID` | 400 | `responseId` fails format validation. |
| `RESPONSE_ID_NOT_FOUND` | 404 | `responseId` unknown or expired. |
| `NO_SOURCES_AVAILABLE` | 404/503 | No provider returned a playable source. |
| `ENDPOINT_NOT_FOUND` | 404 | Unknown path. |
| `METHOD_NOT_ALLOWED` | 405 | Method not supported for the path. |
| `UNSUPPORTED_MEDIA_TYPE` | 406 | `Accept` header is not `application/json` or `*/*`. |
| `INTERNAL_ERROR` | 500 | Unexpected failure (message hidden in production). |

## 4. Proxy endpoint

`GET /v1/proxy?data=<encoded>`

The proxy is the only way to fetch media. `data` is a URL-encoded JSON object:

```
data = encodeURIComponent( JSON.stringify( { "url": "<upstream url>", "headers": { ... } } ) )
```

Example (decoded):

```json
{
  "url": "https://cdn.upstream.example/2026/10/16/file/index.m3u8",
  "headers": { "Referer": "https://player.upstream.example/", "Origin": "https://player.upstream.example" }
}
```

Behaviour:

- The `Range`/`range` header from the client request is merged into `headers` and forwarded
  upstream, so byte-range seeking works.
- If the upstream URL matches a stream pattern (section 6), the response is **streamed**
  (chunked, with `Content-Range`, `Accept-Ranges`, `Content-Length`, `Last-Modified`, and
  `ETag` passed through). Otherwise it is **buffered** and sent whole.
- Manifest files (HLS `.m3u8`, DASH `.mpd`, and other text-based media) are **rewritten**: every
  segment and sub-URL inside the manifest is re-pointed through `/v1/proxy` so the client can
  keep fetching through the proxy. This is what makes HLS/DASH playback work end to end.
- Upstream 5xx responses surface as `INTERNAL_ERROR`.
- Missing or malformed `data` returns `MISSING_PARAMETER` / `INVALID_PARAMETER` (400).

## 5. How source URLs are built

Providers call `createProxyUrl(upstreamUrl, headers)`, which produces an absolute URL:

```
{publicUrl}/v1/proxy?data=<encodeURIComponent(JSON.stringify({url, headers}))>
```

`publicUrl` is resolved at startup: `PUBLIC_URL` if set, otherwise
`http://localhost:<port>` when bound to `0.0.0.0`, otherwise `http://<host>:<port>`. The
`headers` object carries the `Referer`/`Origin`/`User-Agent` the provider needs for the upstream
to accept the request. So a `Source.url` is a self-contained, playable address — Giga Stream can
hand it straight to a player.

The proxy also **unwraps third-party proxies**: before a provider's URL is used, the framework
checks it against `knownThirdPartyProxies` (`thirdPartyProxies.ts`) and extracts the real
upstream URL when the provider returned a proxy-wrapper (e.g. `.../m3u8-proxy?url=...`).
Patterns in `streamPatterns.ts` mark which upstream domains should be streamed rather than
buffered.

## 6. Stream vs buffered detection

A request is streamed when the upstream URL matches any configured stream pattern. The default
patterns (always on) are `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov` (end of URL or before a query
string). CinePro adds, in `streamPatterns.ts`:

| Pattern | Why |
|---|---|
| `pixeldrain.dev`, `pixeldra.in` | file host |
| `hub.raj.lat`, `hub.toxix.buzz`, `hub.oreao-cdn.buzz` | file host |
| `wasabisys.com` | file host |
| `hakunaymatata.com` | file host |
| `streamflixserver.site`, `tripplestream.online` | stream servers |
| `illimitableinkwell.site` | stream server |
| `frostcomet5.pro` | stream server |
| `epimetheus63/earth14/pandora20.workers.dev` | StreamMafia workers.dev proxies |
| `tiktokcdn.com` | file host |
| `/content/.../page-...html` | page-based content |
| `trendimovies.com/tgstream/stream` | stream server |

Everything else (including `.m3u8` and `.mpd` manifests and `.ts` segments fetched via the
rewritten manifest) is handled by the buffered path, which still rewrites manifests.

## 7. Stremio addon (optional)

Enabled with `STREMIO_ADDON=true`. Two routes:

`GET /stremio/manifest.json`:

```json
{
  "id": "omss.cinepro",
  "version": "1.0.0",
  "name": "CinePro",
  "description": "Your backend exposed as a Stremio addon",
  "resources": ["stream"],
  "types": ["movie", "series"],
  "catalogs": [],
  "idPrefixes": ["tmdb", "tt"]
}
```

`GET /stremio/stream/{type}/{id}.json` — `type` is `movie` or `series` (or `tv`). `id` accepts:

| Form | Meaning |
|---|---|
| `tt1234567` | IMDb movie |
| `tmdb:603` | TMDB movie |
| `tt1234567:1:2` | IMDb series S01E02 |
| `tmdb:1399:1:1` | TMDB series S01E01 |

IMDb ids are resolved to TMDB ids via TMDB. The response is the Stremio `streams` array, where
each stream's `url` is the same proxy URL from section 3.5, `name` is
`CinePro [quality • TYPE]`, and `title` carries provider, audio, and "Proxied" lines.

## 8. MCP endpoint (optional)

Enabled with `MCP_ENABLED=true`, at `POST /mcp` (path configurable). JSON-RPC 2.0 (protocol
version `2025-06-18`, server `omss-mcp` 1.0.0). Methods: `initialize`, `tools/list`,
`tools/call`.

The single tool is `omss_get_sources`:

| Argument | Type | Required | Notes |
|---|---|---|---|
| `tmdbId` | string | yes | TMDB id as a string. |
| `mediaType` | `movie \| tv` | yes | |
| `season` | integer | for `tv` | |
| `episode` | integer | for `tv` | |

Returns the same `SourceResponse` (section 3.5) as the HTTP endpoints.

---

## 9. Providers

Providers are TypeScript classes extending `BaseProvider` from `@omss/framework`,
auto-discovered from `src/providers/<name>/<name>.ts` at startup. Each declares an `id`, `name`,
`enabled` flag, `BASE_URL`, request `HEADERS`, `capabilities` (which content types it serves),
and implements `getMovieSources` / `getTVSources` (and optionally `healthCheck`).

The server fans a request out to **all enabled providers** that support the requested content
type, concurrently, and merges the results. A provider that throws is caught and reported as a
`PROVIDER_ERROR` diagnostic; it never fails the whole request. Sources and subtitles are then
deduplicated by upstream URL.

### 9.1 `ProviderMediaObject` — what each provider receives

```ts
interface ProviderMediaObject {
    type: 'movie' | 'tv';
    tmdbId: string;        // TMDB id as a string
    s?: number;            // season (tv only)
    e?: number;            // episode (tv only)
    releaseYear: string;   // e.g. "2019"
    imdbId: string;        // e.g. "tt6751668" (may be '')
    title: string;
}
```

### 9.2 Provider list (from `src/providers`)

| Provider id | Name | Enabled | Capabilities | Upstream base |
|---|---|---|---|---|
| `02moviedownloader` | 02MovieDownloader | **no** | movies, tv | `https://02moviedownloader.site` |
| `anyembed` | AnyEmbed | **no** | movies, tv | `https://api.anyembed.xyz` |
| `CineSu` | CineSu | yes | movies, tv | `https://cine.su` |
| `fmovies4u` | Fmovies4U | **no** | movies, tv | `https://fmovies4u.com` |
| `fsharetv` | FshareTV | yes | movies | `https://fsharetv.cc` |
| `Icefy` | Icefy | yes | movies, tv | `https://streams.icefy.top` |
| `Peachify` | Peachify | yes | movies, tv | `https://peachify.top` |
| `popr` | Popr | yes | movies, tv | `https://popr.ink` |
| `streammafia` | MafiaEmbed | yes | movies, tv | `https://player.nhdapi.com` |
| `tulnex` | Tulnex | yes | movies, tv | `https://api.tulnex.com` |
| `vidapi` | VidApi | yes | movies, tv | `https://vaplayer.ru` |
| `Videasy` | Videasy | yes | movies, tv | `https://api.videasy.net` |
| `vidnest` | VidNest | yes | movies, tv | `https://vidnest.fun` |
| `vidrock` | VidRock | yes | movies, tv | `https://vidrock.net/` |
| `vidsrc` | VidSrc | yes | movies, tv | `https://vsembed.ru/` |
| `vidzee` | VidZee | yes | movies, tv | `https://core.vidzee.wtf` |
| `vixsrc` | VixSrc | yes | movies, tv | `https://vixsrc.to` |

13 are enabled by default; `02moviedownloader`, `anyembed`, and `fmovies4u` are disabled in
source. Only `fsharetv` is movie-only.

### 9.3 Fan-out: where the "50+ sources" come from

Five providers fan out to **multiple upstream servers** per title, in parallel:

| Provider | Upstream servers | Count |
|---|---|---|
| **Tulnex** (`tulnex.ts:26`) | `onion`, `vidzee`, `icefy`, `tik`, `vaplayer`, `vidfast-alpha`, `uniquestream`, `vidfast-mega`, `vidfast-vrapid`, `allmovies`, `vidlink`, `vidfast-vedge`, `vidfast-vfast`, `moviebox` | **14** |
| **VidZee** (`vidzee.ts:66`) | numbered servers `sr=0` through `sr=13` via `player.vidzee.wtf/api/server?id={tmdb}&sr={n}` | **14** |
| **VidNest** (`vidnest.ts:47`) | `moviebox`, `allmovies`, `catflix`, `purstream`, `hollymoviehd`, `lamda`, `flixhq`, `vidlink`, `onehd`, `klikxxi` (8 have response handlers) | **10** |
| **Popr** (`popr.ts:122`) | `default`, `catflix`, `hexa`, `Gama`, `Liligoon`, `Sigma`, `Prime`, `Alfa`, `Lamda`, `ynx_vidsrc` | **10** |
| **Peachify** (`peachify.ts:32`) | moviebox, holly, air, multi, net, bmb (across `uwu.eat-peach.sbs` + `usa.eat-peach.sbs`) | **6** |

That's **54 upstream server lookups** from just these five providers alone — each returning 1+
playable stream. Add the ~8 single-upstream providers and you're comfortably past 50 distinct
sources per title, before counting multi-language audio variants (StreamMafia resolves all
`switches` dubs in parallel) and dedup.

### 9.4 Per-provider upstream contracts

Each subsection below documents the exact HTTP request a provider makes to its upstream and the
response shape it parses. These are the contracts Giga Stream must respect if it ever re-
implements a provider, or must understand to debug a broken one.

---

#### 9.4.1 Tulnex — 14 servers

**Upstream:** `https://api.tulnex.com`

For each of the 14 `SERVERS` names, the provider issues (in parallel via `Promise.allSettled`):

| | |
|---|---|
| **Movie** | `GET https://api.tulnex.com/{server}/movie/{tmdbId}` |
| **TV** | `GET https://api.tulnex.com/{server}/tv/{tmdbId}/{s}/{e}` |

Headers: randomized or fixed desktop `User-Agent`, `accept: text/html,...`,
`accept-language: en-US,en;q=0.9`, `cache-control: no-cache`, `Accept: application/json, */*`.

**Response** (JSON):

```json
{ "v": "1", "payload": "<encrypted base64 string>" }
```

The `payload` is decrypted (AES) and the resulting JSON is parsed for a stream URL plus optional
headers. Each successful server yields one `Source` (type `mp4` if the URL contains `mkv`/`mp4`,
else `hls`; quality `Auto`; single `Original` audio track). Servers that fail or return no
`payload` are silently dropped.

---

#### 9.4.2 VidZee — 14 servers

**Upstream:** `https://player.vidzee.wtf` (player), `https://core.vidzee.wtf` (core)

1. **Fetch decryption key** — a one-time key is fetched from the core API.
2. For each `serverId` 0–13 (in parallel via `Promise.allSettled`):

| | |
|---|---|
| **Movie** | `GET https://player.vidzee.wtf/api/server?id={tmdbId}&sr={serverId}` |
| **TV** | `GET https://player.vidzee.wtf/api/server?id={tmdbId}&sr={serverId}&type=tv&season={s}&episode={e}` |

Headers: Linux Chrome `User-Agent`, `Accept: application/json, text/javascript, */*; q=0.01`,
`Referer: https://player.vidzee.wtf`, `Origin: https://player.vidzee.wtf`.

**Response** (JSON, `StreamResponse`):

```json
{
  "headers": { "User-Agent": "..." },
  "provider": "vidzee",
  "servers": [ ],
  "url": [
    { "lang": "English", "link": "https://cdn.../index.m3u8", "type": "hls", "message": "", "name": "1080p", "flag": "en" }
  ],
  "tracks": [ { "lang": "English", "url": "https://.../en.vtt" } ],
  "proxy": true,
  "thumbnail": "https://.../thumb.jpg",
  "serverInfo": { "number": 0, "name": "vidzee", "flag": "en", "language": "English" }
}
```

The response is decrypted using the key from step 1. Each entry in `url[]` becomes a `Source`;
entries in `tracks[]` become `Subtitle`s (deduped by `lang`+`serverInfo.number`). Type is `mp4`
if the link points at a `serversicuro.cc` host, else `hls`.

---

#### 9.4.3 VidNest — 10 servers

**Upstream:** `https://new.vidnest.fun` (API), `https://vidnest.fun` (base)

For each of the 10 servers (in parallel), the provider queries:

```
GET https://new.vidnest.fun/{path}{query}
```

| Server path | Query |
|---|---|
| `moviebox` | |
| `allmovies` | |
| `catflix` | |
| `purstream` | |
| `hollymoviehd` | |
| `lamda` | |
| `flixhq` | |
| `vidlink` | |
| `onehd` | `?server=upcloud` |
| `klikxxi` | |

Headers: Chrome `User-Agent`, `Accept: application/json, text/javascript, */*; q=0.01`,
`Referer: https://vidnest.fun/`, `Origin: https://vidnest.fun`.

**Response** — **different per server**. Each is either plain JSON or an encrypted envelope
`{ "encrypted": true, "data": "<string>" }` that must be decrypted. The 8 servers with handlers
return distinct shapes:

| Server | Response shape (key fields) |
|---|---|
| `klikxxi` | `{ sources: [{ quality, type, url }], title, year }` |
| `allmovies` | `{ streams: [{ headers, language, type, url }], totalLanguages }` |
| `hollymoviehd` | `{ sources: [{ file, label, type }], success }` |
| `vidlink` | `{ data: { sourceId, stream: { TTL, captions, flags, id, playlist, type } }, headers, provider }` |
| `onehd` | `{ headers, subtitles: [{ lang, url }], url }` |
| `purstream` | `{ purstream_id, sources: [{ format, name, url }], title }` (French) |
| `delta` | `{ streams: [{ headers, language, type, url }], totalLanguages }` |
| `moviebox` | `{ headers, needConfig, provider, proxy, url: [{ lang, link, resolution, type }] }` |

Each parsed source becomes a `Source` with type inferred from URL (`inferSourceType`), quality
from the server's field, and a single `English / eng` audio track. Subtitles come from
`vidlink.captions`, `onehd.subtitles`, and `moviebox` where present.

---

#### 9.4.4 Popr — 10 servers

**Upstream:** `https://popr.ink`

For each of the 10 server names (in parallel), the provider queries:

| | |
|---|---|
| **Movie** | `GET https://popr.ink/api/vidnest?id={tmdbId}&type=movie[&server={server}]` |
| **TV** | `GET https://popr.ink/api/vidnest?id={tmdbId}&type=tv&server={server}&season={s}&episode={e}` |

(`server` is omitted for the `default` entry on movies.)

Headers: Chrome `User-Agent`, `Referer: https://popr.ink/`.

**Response** (JSON, `VidnestResponse`):

```json
{
  "success": true,
  "results": [
    {
      "server": "catflix",
      "serverName": "CatFlix",
      "streams": [
        { "url": "https://cdn.../index.m3u8", "quality": "1080p", "isM3U8": true, "headers": { "Referer": "...", "Origin": "..." } }
      ],
      "subtitles": [ { "url": "https://.../en.srt", "format": "srt", "lang": "English" } ]
    }
  ]
}
```

Each entry in `results[].streams[]` is validated (the provider does a 5-second-timeout `fetch` to
confirm the stream is playable and detect its type), then becomes a `Source`. Subtitles are
deduplicated. Non-200 responses are skipped.

---

#### 9.4.5 Peachify — 6 servers

**Upstream:** `https://peachify.top` (base), `https://uwu.eat-peach.sbs` (MovieBox),
`https://usa.eat-peach.sbs` (API)

For each of the 6 servers (in parallel), the provider queries the server's endpoint with TMDB
parameters. The 6 endpoints are:

| Endpoint |
|---|
| `https://uwu.eat-peach.sbs/moviebox/...` |
| `https://usa.eat-peach.sbs/holly/...` |
| `https://usa.eat-peach.sbs/air/...` |
| `https://usa.eat-peach.sbs/multi/...` |
| `https://uwu.eat-peach.sbs/net/...` |
| `https://uwu.eat-peach.sbs/bmb/...` |

Headers: randomized desktop `User-Agent` (rotated per request), `Accept: application/json,
text/javascript, */*; q=0.01`, `Referer: https://peachify.top/`, `Origin: https://peachify.top`.

**Response** (JSON, `PeachifyApiResponse`) — either plain or encrypted:

```json
{
  "isEncrypted": true,
  "data": "<dot-separated aes-gcm ciphertext>"
}
```

or

```json
{
  "sources": [
    { "url": "https://cdn.../index.m3u8", "type": "hls", "quality": "1080p", "language": "English", "headers": { "Referer": "..." } }
  ],
  "subtitles": [ { "url": "https://.../en.srt", "label": "English", "lang": "en" } ]
}
```

When `isEncrypted` is true, `data` is decrypted (AES-GCM). The raw source objects are highly
inconsistent across servers — fields may be `url`/`src`/`file`/`stream`/`streamUrl`/`playbackUrl`,
language may be `dub`/`audio`/`language`/`lang`/`label`, quality may be `quality`/`resolution`/
`height`/`res` — so the provider normalizes each into a `PeachifyParsedSource` before emitting.

---

#### 9.4.6 VidSrc — single upstream (3-hop chain)

**Upstream:** `https://vsembed.ru/`

A three-hop scrape:

1. `GET https://vsembed.ru/embed/movie?tmdb={tmdbId}`
   (or `https://vsembed.ru/embed/tv?tmdb={tmdbId}&season={s}&episode={e}`)
2. Extract the `<iframe src="...">` URL from the HTML, fetch it.
3. Extract the inline-JS `loadIframe` `src:` URL, resolve it against step 2's domain, fetch it.
4. In the final HTML, read the `file: "..."` field, split on `or`, and substitute the
   `{v1}`–`{v4}` domain placeholders:

   | Placeholder | Domain |
   |---|---|
   | `{v1}` | `neonhorizonworkshops.com` |
   | `{v2}` | `wanderlynest.com` |
   | `{v3}` | `orchidpixelgardens.com` |
   | `{v4}` | `cloudnestra.com` |

Each resulting m3u8 URL becomes a `Source` (type `hls`, quality `Auto`, `English / eng`), with
`Referer`/`Origin` set to `https://cloudnestra.com`. Headers: Chrome `User-Agent`,
`Referer: https://vsembed.ru/`.

VidSrc blocks VPN IPs — the provider's empty-result diagnostic notes this.

---

#### 9.4.7 VidApi — single upstream

**Upstream:** `https://streamdata.vaplayer.ru/api.php`

| | |
|---|---|
| **Movie** | `GET https://streamdata.vaplayer.ru/api.php?tmdb={tmdbId}&type=movie` |
| **TV** | `GET https://streamdata.vaplayer.ru/api.php?tmdb={tmdbId}&type=tv&season={s}&episode={e}` |

Headers: randomized desktop `User-Agent`, `Referer: https://brightpathsignals.com/`,
`Origin: https://brightpathsignals.com`, `Accept: */*`.

**Response** (JSON, `VidApiResponse`):

```json
{
  "status_code": "200",
  "data": {
    "title": "Inception",
    "imdb_id": "tt1375666",
    "season": "1",
    "episode": "1",
    "file_name": "Inception.2010.1080p",
    "backdrop": "https://.../backdrop.jpg",
    "stream_urls": ["https://cdn.../inception_1080p.mp4", "https://cdn.../inception_720p.m3u8"]
  },
  "default_subs": [
    { "lang": "English", "code": "en", "url": "https://.../inception_en.srt" }
  ]
}
```

Each entry in `data.stream_urls[]` becomes a `Source` (type `mp4` if the URL contains `mp4`/
`mkv`, else `hls`; quality inferred from `file_name`; single `Original` audio track). Each entry
in `default_subs[]` becomes a `Subtitle` (format inferred from extension: `vtt`/`ass`/`ssa`/
`ttml`/`srt`). `status_code` must be `"200"` and `data` must be present.

---

#### 9.4.8 CineSu — single upstream

**Upstream:** `https://cine.su`

Builds a manifest URL from the TMDB id (movie: `cine.su` manifest path; TV: with season/episode),
verifies it is reachable with a HEAD test, then returns a single `Source` (type `hls`, quality
`1080`, `English / eng`). Headers: Chrome `User-Agent`, `Accept: application/json,
text/javascript, */*; q=0.01`, `Referer: https://cine.su/en/watch`, `Origin: https://cine.su`.

If the manifest URL is not reachable, the provider returns an empty result with diagnostic
`Stream URL is not accessible`.

---

#### 9.4.9 Icefy — single upstream

**Upstream:** `https://streams.icefy.top`

| | |
|---|---|
| **Movie** | `GET https://streams.icefy.top/movie/{tmdbId}` |
| **TV** | `GET https://streams.icefy.top/tv/{tmdbId}/{s}/{e}` |

Headers: Chrome `User-Agent`, `Accept: application/json, text/javascript, */*; q=0.01`,
`Referer: https://streams.icefy.top`, `Origin: https://streams.icefy.top`.

**Response** (JSON):

```json
{ "stream": "https://cdn.icefy.../index.m3u8" }
```

The `stream` URL becomes a single `Source` (type `hls`, quality `1080`, `English / eng`). A 403
status means Cloudflare blocked the request — the diagnostic suggests solving the CAPTCHA
manually at the base URL.

---

#### 9.4.10 StreamMafia (MafiaEmbed) — single upstream (multi-step)

**Upstream:** `https://player.nhdapi.com`

A multi-step session flow:

1. **Session cookie** — a request to the base URL obtains a `Set-Cookie`.
2. **Page fetch** —
   - Movie: `GET https://player.nhdapi.com/api/movie/?id={tmdbId}`
   - TV: `GET https://player.nhdapi.com/api/?tv={tmdbId}&season={s}&episode={e}`

   Returns an encrypted payload (`{ iv, tag, data }`, AES-GCM) which is decrypted into
   `ApiResponse`.
3. **Switches** — each entry in `api.switches[]` (alternate audio/dub) is resolved in parallel.

**Response** (JSON after decryption, `ApiResponse`):

```json
{
  "status": "ok",
  "requested": { "id": 12345 },
  "selected": { "file_code": "...", "lang_code": "en", "lang": "English", "title": "...", "source_title": "..." },
  "switches": [
    { "id": 1, "title": "French Dub", "main_id": "...", "secondary_id": "...", "file_code": "...", "lang_code": "fr", "lang": "French", "thumbnail": "...", "embed_url": "...", "uploaded_at": "...", "created_at": "..." }
  ],
  "stream": {
    "status": "ok",
    "title": "...",
    "hls_streaming": "https://cdn.../index.m3u8",
    "duration": "7925",
    "thumbnail_small": "...",
    "thumbnail_medium": "...",
    "thumbnail_hd": "...",
    "download": [ { "quality": "1080p", "url": "https://.../movie.mp4" } ],
    "preview_video": [ { "url": "...", "frequency": 24, "height": 1080, "width": 1920, "count": 1, "tileWidth": 1920, "tileHeight": 1080 } ]
  },
  "source": { "goal_api": "..." }
}
```

The main `stream.hls_streaming` becomes the primary `Source`. Each `switches[]` entry resolves to
an additional `Source` (the dub). Headers: randomized desktop `User-Agent`.

---

#### 9.4.11 VixSrc — single upstream (4-hop chain)

**Upstream:** `https://vixsrc.to`

A four-hop scrape:

1. `GET https://vixsrc.to/api/movie/{tmdbId}`
   (or `https://vixsrc.to/api/tv/{tmdbId}/{s}/{e}`)

   **Response** (JSON): `{ "src": "/embed/..." }` — a relative path to an embed page.
2. Fetch `https://vixsrc.to{src}` (the embed page HTML).
3. Extract `token`, `expires`, and `url` (playlist) from the HTML. Validate the token is not
   expired (`expires * 1000 - 60_000 > Date.now()`).
4. Build the master playlist URL:
   `{playlist}{'?'|'&'}token={token}&expires={expires}&h=1`
   and fetch it (with `Referer` set to the original page URL).
5. Parse the HLS master playlist:
   - **Audio tracks** — from `#EXT-X-MEDIA:TYPE=AUDIO` lines (`LANGUAGE` + `NAME`).
   - **Variants** — from `#EXT-X-STREAM-INF:...RESOLUTION=WxH` lines; pick the highest resolution.
   - **Subtitles** — from `#EXT-X-MEDIA:TYPE=SUBTITLES` (currently disabled in code, returns `[]`).

The master playlist URL becomes a single `Source` (type `hls`, quality `{bestResolution}p`,
audio tracks parsed from the manifest). Headers: Chrome `User-Agent`, `Accept: application/json,
text/javascript, */*; q=0.01`, `Referer`/`Origin: https://vixsrc.to`.

---

#### 9.4.12 VidRock — single upstream (2-step)

**Upstream:** `https://vidrock.net/` (page), `https://sub.vdrk.site` (subs),
`https://proxy.vidrock.store/` (proxy prefix)

1. Build a page URL from the TMDB id (movie/TV path), fetch it.
   **Response** (JSON, `VidrockStreams`):

   ```json
   {
     "1": { "url": "https://hls2.vdrk.site/...", "language": "English", "flag": "en" },
     "2": { "url": "https://cdn.../movie.m3u8", "language": null, "flag": null }
   }
   ```

2. For each entry:
   - If the URL contains `hls2.vdrk.site`, fetch it again —
     **Response** (JSON array, `VidrockCDN[]`):
     ```json
     [ { "resolution": "1080", "url": "https://proxy.vidrock.store/<encoded path>" } ]
     ```
     For each CDN entry, if the URL starts with `https://proxy.vidrock.store/`, strip the prefix
     and URL-decode the remainder to get the final URL. Each becomes a `Source` (type `mp4` if
     `.mp4`, else `hls`; quality `{resolution}p`; audio from `stream.language`).
   - Otherwise the URL is used directly (with special `Referer`/`Origin` for `67streams` URLs),
     becoming a `Source` (type `hls`, quality `1080`).

Headers: Chrome `User-Agent`, `Accept: application/json, text/javascript, */*; q=0.01`,
`Referer`/`Origin: https://vidrock.net/`.

---

#### 9.4.13 FshareTV — single upstream (3-step, movies only)

**Upstream:** `https://fsharetv.cc`

A three-step scrape using the **IMDb id** (not TMDB):

1. `GET https://fsharetv.cc/movie/{imdbId}` — extract the `href="/w/..."` watch path from the HTML.
2. Fetch the watch page, extract the source ID.
3. `GET https://fsharetv.cc/api/...` (with `X-Requested-With: XMLHttpRequest`) using the source ID.

**Response** (JSON, `FshareResponse`):

```json
{
  "data": {
    "file": {
      "sources": [ { "src": "https://cdn.../index.m3u8", "label": "1080p", "type": "hls", "quality": 1080, "storage": "...", "id": "...", "selected": true } ],
      "backups": [ ],
      "alternatives": [ [ ] ],
      "downloads": [ { "src": "https://.../movie.mkv", "label": "1080p" } ],
      "vast": 0
    }
  },
  "status": "ok"
}
```

Each entry in `file.sources[]` becomes a `Source`. The `TRAILER` constant
(`Png81APqcxU`) is used internally. Headers: Edge `User-Agent`, `Accept: text/html,...`,
`Referer: https://fsharetv.cc`.

---

#### 9.4.14 02MovieDownloader — single upstream (disabled)

**Upstream:** `https://02moviedownloader.site`

Disabled in source (`enabled = false`) because the upstream uses a Cloudflare Turnstile.

A two-step flow:

1. **Token** — `POST https://02moviedownloader.site/api/verify-robot` with full browser sec-fetch
   headers.
   **Response** (JSON, `Token`):
   ```json
   { "success": true, "token": "...", "expiresIn": 300 }
   ```
2. **Download data** — `GET https://02moviedownloader.site/api/download/movie/{tmdbId}`
   (or `/api/download/tv/{tmdbId}{s}{e}`) with the token.

   **Response** (JSON, `MovieDownloaderResponse`):
   ```json
   {
     "success": true,
     "tmdbId": "603",
     "originalId": "...",
     "data": {
       "success": true,
       "heading": "...",
       "title": "Inception",
       "year": "2010",
       "subjectId": "...",
       "detailPath": "...",
       "detailsUrl": "...",
       "videoPlayerUrl": "...",
       "downloadData": {
         "code": 0,
         "message": "...",
         "data": {
           "downloads": [ { "id": "...", "url": "https://.../movie.mp4", "resolution": 1080, "size": "2.3 GB" } ],
           "captions": [ { "lan": "en", "lanName": "English", "url": "https://.../en.srt", "size": "12 KB", "delay": 0 } ],
           "limited": false,
           "limitedCode": "",
           "freeNum": 3,
           "hasResource": true
         }
       }
     },
     "externalStreams": [
       { "name": "...", "title": "...", "url": "https://.../stream.m3u8", "quality": "1080p", "type": "hls", "headers": { "Referer": "..." }, "filename": "..." }
     ]
   }
   ```

The response may be an encrypted envelope (`{ encrypted: true, data: "..." }`, AES-256-CBC with a
per-token-derived key) that must be decrypted first.

---

#### 9.4.15 AnyEmbed — single upstream (disabled)

**Upstream:** `https://api.anyembed.xyz`

Disabled in source (`enabled = false`) because the upstream API is unstable (intermittent 403/500).

A two-step flow:

1. **Session token** — `GET https://api.anyembed.xyz/api/v1/session`.
   **Response** (JSON, `TokenResponse`):
   ```json
   { "expires_in": 3600, "success": true, "token": "..." }
   ```
2. **Sources** — query the API with the `x-session-token` header and TMDB parameters.
   **Response** (JSON, `AnyEmbedApiResponse`):
   ```json
   {
     "extraction_mode": "auto",
     "feedback_exp": 0,
     "feedback_token": "",
     "proxy_exp": 0,
     "proxy_token": "",
     "sources": [
       {
         "confidence": "high",
         "penalty": 0,
         "provider": "vidsrc",
         "requires_proxy": true,
         "score": 95,
         "scrape_type": "hls",
         "streams": [
           { "format": "hls", "headers": { "Referer": "..." }, "proxy_mode": "full", "quality": "1080p", "quality_score": 90, "requires_proxy": true, "subtitles": [ { "label": "English", "language": "en", "url": "https://.../en.vtt" } ], "url": "https://cdn.../index.m3u8" }
         ],
         "success_rate": 98,
         "timestamp": 1700000000
       }
     ],
     "success": true,
     "title": "Inception",
     "year": 2010
   }
   ```

Each entry in `sources[].streams[]` becomes a `Source`; `streams[].subtitles[]` become
`Subtitle`s.

---

#### 9.4.16 Fmovies4U — single upstream (disabled)

**Upstream:** `https://fmovies4u.com`

Disabled in source (`enabled = false`) — the provider is currently broken upstream.

| | |
|---|---|
| **Movie** | `GET https://fmovies4u.com/api/movie/{tmdbId}?_cb={timestamp}` |
| **TV** | `GET https://fmovies4u.com/api/tv/{tmdbId}/{s}/{e}?_cb={timestamp}` |

Headers: Chrome `User-Agent`, `Accept: application/json, text/javascript, */*; q=0.01`,
`Referer` set to the media's page URL.

**Response** — an encrypted text blob (not JSON) that is decrypted into `ApiResponse`:

```json
{
  "success": true,
  "sources": [
    {
      "url": [ { "link": "https://cdn.../index.m3u8", "type": "hls", "lang": "en", "quality": "1080p" } ],
      "headers": { "Referer": "..." },
      "tracks": [ ],
      "provider": "vidsrc",
      "servers": ["vidsrc"],
      "proxy": true,
      "responseTime": 123
    }
  ],
  "imdbId": "tt1375666",
  "tmdbId": "603"
}
```

Each entry in `sources[].url[]` becomes a `Source`.

---

## 10. Integration notes for Giga Stream

- Call `GET /v1/movies/{tmdbId}` or `GET /v1/tv/{tmdbId}/seasons/{s}/episodes/{e}` with the TMDB
  id Giga Stream already has from `11`. Handle the error envelope (section 3.6) — in particular
  `NO_SOURCES_AVAILABLE` means "nothing to play right now", not a crash.
- Play `sources[].url` directly in the player. It already routes through CinePro's proxy,
  handles range requests, and rewrites HLS/DASH manifests. No further URL work is needed.
- Use `subtitles[].url` for caption tracks; `format` tells the player which parser to use.
- To force a re-scrape (e.g. a source went dead), call `GET /v1/refresh/{responseId}` with the
  `responseId` from the last response, then request sources again.
- Read `diagnostics[]` to surface "only some providers worked" or per-provider failures to the
  user without treating them as fatal.
- If Giga Stream's server runs on a different host than the CinePro instance, set `PUBLIC_URL` on
  CinePro so proxy URLs are absolute and reachable from the browser.
- The optional Stremio (section 7) and MCP (section 8) endpoints exist but are not required for
  direct HTTP integration.
- Upstream providers are third-party and change without notice. A provider that breaks is
  reported as a `PROVIDER_ERROR` diagnostic, not a crash. The fan-out design (section 9.3) means
  a single provider failure rarely removes all sources for a title.
