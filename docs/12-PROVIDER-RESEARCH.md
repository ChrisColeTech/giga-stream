# 12 - Provider API Reference

**Status: verified live on 2026-10-16 with read-only requests** (each provider's section says what was
checked and what differed). The full reference for three video providers, VidSrc, VixSrc and VidZee,
first recorded in `D:\Projects\giga-stream-rust\docs\01-API-REFERENCE.md` (commit
`f63edb1e48f2fc09f51a45ea531f48fe78fd2380`) and copied on 2026-10-15. No Giga Stream program calls these
services. What the checks mean for playback is section 7.

## 1. Where providers fit

- Providers live in the admin backend and nowhere else (`00`, `01` section 1.3). The fileserver and the
  interface do not know what a provider is.
- **Metadata comes from TMDB** (`11`), not from providers. A provider's job is to say which titles it has
  and to supply something that plays.
- A provider's embed address is filled in from the TMDB id, season and episode by a template; there is no
  resolve step. The title plays in that embedded player inside the Player stage (section 7, `14`).

### 1.1 What the archive's backend had

At `before-live-restart`, the admin backend held provider **definitions** as administered records and
nothing more: an adapter (`vidsrc`, `vixsrc`, `vidzee`, `generic-embed` with movie and episode URL
templates and allowed origins, or `generic-hls` with a manifest template and allowed origins), a name, an
`https` base URL, capabilities (`metadata`, `search`, `movie`, `episode`, `embed`, `hls`), on by default or
not, and a sort order. It had no provider client, no HTTP transport and no stream addresses. None of that
is carried into the rebuild.

## 2. Shared concepts

### 2.1 Ids

| Id | Form | Example | Source |
|---|---|---|---|
| IMDb | `tt` and digits | `tt1300854` | imdb.com |
| TMDB movie or series | a number | `603` | themoviedb.org |
| TMDB episode | a number | `62772` | themoviedb.org |

A title carries both ids when it can (`11` section 3). VidZee requires the TMDB id; VidSrc's detail can
turn an IMDb id into a TMDB one.

### 2.2 Embed pages, not manifests

All three services were recorded as browser **embed pages**, not documented HLS manifests. The earlier
research considered playing them in an iframe and, later, finding a manifest behind the page. Neither is
part of Giga Stream's design; which, if any, is acceptable is the owner's decision in `13` section 5.

### 2.3 Player message units

The players' messages report position and duration in **seconds**. Anything reading them converts to
integer milliseconds, and validates each message against the expected frame, the exact allowed origin and
its schema; ids and durations in a message are never trusted without matching what was asked to play.

## 3. VidSrc

| Item | Recorded value |
|---|---|
| Base URL | `https://vidsrc.sh` |
| Documentation | `https://vidsrc.sh/vidsrc/docs/` |
| Key | none |
| Role in the research | metadata, latest feeds, id lists and embed |
| Mirrors | `vidsrc.cc`, `vidsrc.is`, `vidsrc.xyz`; the docs say every domain serves the same content |
| CORS | `Access-Control-Allow-Origin: *` on `/info/` and the feeds and `/ids/` (verified) |

**Verified 2026-10-16.** The documentation page is live. `/info` for a movie, a series and an episode, the
not-found answer, the movie and episode latest feeds and the `movie_tmdb` id list all answered exactly in
the shapes below. Differences and additions are marked *(2026-10-16)*.

### 3.1 Embed pages

**Movie** — `GET https://vidsrc.sh/embed/movie/{id}`, where `id` is IMDb or TMDB:

```text
https://vidsrc.sh/embed/movie/tt1300854
https://vidsrc.sh/embed/movie/603
```

**Series** — `GET https://vidsrc.sh/embed/tv/{id}/{season}/{episode}` or
`GET https://vidsrc.sh/embed/tv/{id}/{season}-{episode}`:

```text
https://vidsrc.sh/embed/tv/1399/1/1
https://vidsrc.sh/embed/tv/tt0944947/2/6
```

The whole series, with the provider's own picker: `https://vidsrc.sh/embed/tv/1399`. It resumes the
last-watched episode and position by itself *(2026-10-16)*.

**Query forms:**

```text
https://vidsrc.sh/embed/movie?imdb=tt1300854
https://vidsrc.sh/embed/movie?tmdb=603
https://vidsrc.sh/embed/tv?tmdb=1399&season=1&episode=1
https://vidsrc.sh/embed/tv?imdb=tt0944947&season=1&episode=1
```

### 3.2 Embed parameters

| Parameter | Values | Meaning |
|---|---|---|
| `autoplay` | `0` or `1` | ask the player to start by itself. On the official domains the player always shows a play button first; opening straight into playback works only on a custom domain (3.7) *(2026-10-16)* |
| `autonext` | `0` or `1` | a series moves to the next episode at the end, with an "Up next" countdown; off by default |
| `startAt` | seconds (a float) | where playback starts |
| `ds_lang` | language list | default subtitle language: ISO 639-1 (`en`) or three-letter (`eng`) codes, a comma-separated priority list of up to three |
| `sub_url` | an `https` address | a custom VTT or SRT track. The viewer's browser fetches and converts it, so its host must send CORS headers *(2026-10-16)* |
| `sub_label` | text | that track's name |
| `sub_lang` | language code | that track's language |

Examples:

```text
https://vidsrc.sh/embed/movie/tt1300854?autoplay=1
https://vidsrc.sh/embed/movie/tt1300854?ds_lang=en
https://vidsrc.sh/embed/movie/tt1300854?autoplay=1&startAt=300
https://vidsrc.sh/embed/tv/tt0944947?autonext=1
```

### 3.3 Information

```http
GET https://vidsrc.sh/info/movie/{id}.json
GET https://vidsrc.sh/info/tv/{id}.json
GET https://vidsrc.sh/info/tv/{id}/{season}/{episode}.json
```

**Movie:**

```json
{
  "status_code": 200,
  "type": "movie",
  "imdb_id": "tt1300854",
  "tmdb_id": "68721",
  "title": "Iron Man 3",
  "year": 2013,
  "quality": "1080p",
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
  "imdb_rating": 7.1,
  "embed_url": "https://vidsrc.sh/embed/movie/tt1300854",
  "embed_url_tmdb": "https://vidsrc.sh/embed/movie/68721",
  "time_added": "2021-03-18 23:43:39"
}
```

**Series:**

```json
{
  "status_code": 200,
  "type": "tv",
  "imdb_id": "tt0944947",
  "tmdb_id": "1399",
  "title": "Game of Thrones",
  "year": 2011,
  "quality": "1080p",
  "seasons": [
    { "season": 1, "episodes": 10, "first_episode": 1, "last_episode": 10, "quality": "1080p" }
  ],
  "total_episodes": 73,
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
  "imdb_rating": 9.2,
  "embed_url": "https://vidsrc.sh/embed/tv/tt0944947",
  "embed_url_tmdb": "https://vidsrc.sh/embed/tv/1399"
}
```

**Episode:**

```json
{
  "status_code": 200,
  "type": "episode",
  "imdb_id": "tt0944947",
  "tmdb_id": "1399",
  "show_title": "Game of Thrones",
  "year": 2011,
  "season": 1,
  "episode": 1,
  "quality": "1080p",
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
  "imdb_rating": 9.2,
  "embed_url": "https://vidsrc.sh/embed/tv/tt0944947/1/1",
  "embed_url_tmdb": "https://vidsrc.sh/embed/tv/1399/1/1",
  "time_added": "2021-03-18 23:58:40"
}
```

**Not found:**

```json
{ "status_code": 404, "error": "not found", "message": "This title is not available." }
```

Quality values: `1080p` (full HD), `720p` (HD), `DVD` (DVD or SD, movies), `SD` (episodes), `CAM` (a cam
recording). For a series, the top-level `quality` is the best across its seasons. Either id form works
(`tt1300854` or `68721`), and answers are cached for about five minutes. A `200` means the title is
available and a `404` that it is not, so availability can be read from the status alone.

### 3.4 Latest

```http
GET https://vidsrc.sh/movies/latest/page-{page}.json
GET https://vidsrc.sh/tvshows/latest/page-{page}.json
GET https://vidsrc.sh/episodes/latest/page-{page}.json
```

```json
{
  "result": [
    {
      "imdb_id": "tt1300854",
      "tmdb_id": "68721",
      "title": "Iron Man 3 2013",
      "embed_url": "https://vidsrc.sh/embed/movie?imdb=tt1300854",
      "embed_url_tmdb": "https://vidsrc.sh/embed/movie?tmdb=68721",
      "quality": "1080p",
      "time_added": "2026-08-04 20:50:35"
    }
  ],
  "pages": 1833
}
```

50 items a page; page 1 is the newest; cached for about five minutes. `tmdb_id` can be `null`, and
`embed_url_tmdb` is then absent. Episode feeds carry `show_title` (with the year), `season` and `episode`
instead of `title`. **On the live feed `season` and `episode` are strings** (`"season":"2026",
"episode":"21"`), although the documentation shows numbers *(2026-10-16)*.

### 3.5 Id lists

```http
GET https://vidsrc.sh/ids/movie_imdb.txt
GET https://vidsrc.sh/ids/movie_tmdb.txt
GET https://vidsrc.sh/ids/tv_imdb.txt
GET https://vidsrc.sh/ids/tv_tmdb.txt
GET https://vidsrc.sh/ids/eps_tmdb.txt
GET https://vidsrc.sh/ids/eps_imdb.txt
```

Plain text, one id per line, updated daily, with CORS. Episode lists use `<tmdbId>_<season>x<episode>`
(`314541_1x3`) and `<imdbId>_<season>x<episode>` (`tt0944947_1x1`) *(2026-10-16)*. These, or `/info`'s
status, are how the backend would learn **which titles VidSrc has**.

### 3.6 Player messages

```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "player_info": { "imdb": "tt1300854", "tmdb": null, "mediaType": "movie", "season": null, "episode": null },
    "player_status": "playing",
    "player_progress": 125.4,
    "player_duration": 7200
  }
}
```

Statuses: `playing`, `paused`, `completed`, `seeked`. While playing, a message about every five seconds.

### 3.7 Custom domain and the embed page *(2026-10-16)*

- The documentation offers a **custom domain**: a Cloudflare `CNAME` to `vidsrc-ip.com` with SSL set to
  Flexible (the connection to VidSrc's origin stays plain HTTP). It promises half the ads, no VidSrc logo,
  and opening straight into playback.
- **The embed page** (`/embed/movie/603`, `/embed/tv/1399/1/1`) is a 57 KB page titled `Player`. It loads
  `/assets/sbx.js` and `/assets/disable-devtool.js` (a script that blocks the browser's developer tools)
  and shows ads. Its HTML contains no stream address and no `.m3u8`.

## 4. VixSrc

| Item | Recorded value |
|---|---|
| Base URL | `https://vixsrc.to` |
| Documentation | inline on the home page |
| Key | none |
| Role in the research | an alternative embed and a flat catalog |
| CORS | none on the catalog (verified) |

**Verified 2026-10-16.** The documentation on `https://vixsrc.to/` (rendered in a browser; it is built
by JavaScript) lists exactly the embed pages, the catalog route, the parameters and the player messages
below, and nothing else. It describes the library as about 45,000 movies and 15,000 shows "scraped from
multiple websites", and offers custom embed domains for "helping bypass ISP blocks and avoid detection".
The catalog and the embed pages answered. **The catalog's shape has changed** (4.2).

### 4.1 Embed pages

**Movie** — `GET https://vixsrc.to/movie/{id}`, TMDB or IMDb: `https://vixsrc.to/movie/786892`.

**Episode** — `GET https://vixsrc.to/tv/{id}/{season}/{episode}`: `https://vixsrc.to/tv/1399/1/1`. Season
and episode are required; a whole-series address must never count as an episode playing.

### 4.2 Catalog

```http
GET https://vixsrc.to/api/list/{type}?lang={language}
```

`type` is `movie`, `tv` or `episode`; `lang` is optional.

```text
https://vixsrc.to/api/list/movie
https://vixsrc.to/api/list/tv?lang=it
https://vixsrc.to/api/list/episode
```

A flat list of ids, not metadata: VixSrc does not supply titles, posters or plots.

**As served on 2026-10-16:** each address redirects to the same path with a trailing slash
(`/api/list/movie/`), and answers one JSON array, the whole catalog at once:

```json
[{ "tmdb_id": 1288069, "imdb_id": "tt6262770" }, { "tmdb_id": null, "imdb_id": null }]
[{ "tmdb_id": 549, "imdb_id": "tt0098844", "s": 26, "e": 2 }]
```

The first shape is `movie` and `tv` (some entries have both ids `null`); the second is `episode`, with the
season in `s` and the episode in `e`. Sizes: movies 1.6 MB, series 0.5 MB, episodes 17 MB.

**The embed page** (`/movie/603`, `/tv/1399/1/1`) is a Next.js application of about 8 KB; its HTML
contains no stream address and no `.m3u8`.

### 4.3 Embed parameters

| Parameter | Values | Meaning |
|---|---|---|
| `primaryColor` | hex without `#` | the player's main colour |
| `secondaryColor` | hex without `#` | progress and background colour |
| `autoplay` | boolean | ask the player to start by itself |
| `startAt` | seconds | where playback starts |
| `lang` | a language | preferred audio language |

```text
https://vixsrc.to/movie/786892?primaryColor=B20710&secondaryColor=170000&autoplay=false&startAt=60&lang=it
```

### 4.4 Player messages

```ts
type VixSrcPlayerFrame = {
  type: "PLAYER_EVENT";
  data: {
    event: "play" | "pause" | "seeked" | "ended" | "timeupdate";
    currentTime: number;   // seconds
    duration: number;      // seconds
    video_id: number;
  };
};
```

### 4.5 Custom domains

The research described custom embed domains and never looked at them. A list of known host names is not
enough to decide what may be called; any use would be decided per address and per resolved destination.

## 5. VidZee

| Item | Recorded value |
|---|---|
| Player base URL | `https://player.vidzee.wtf` |
| Documentation | `https://vidzee.wtf/#api-docs` |
| Key | none |
| Role in the research | an embed fallback, TMDB ids only |

**Verified 2026-10-16.** The documentation at `https://vidzee.wtf/#api-docs` (rendered in a browser; it is
built by JavaScript) lists the v1 and v2 embed pages, the media data and the player messages below, and no
data or stream route. The home page (`VidZee - Lightning-Fast Video Streaming API`) and the embed pages
answered. The player page sends both `X-Frame-Options: SAMEORIGIN` and
`Content-Security-Policy: frame-ancestors *`; current browsers follow the CSP, so it can be framed by any
site. It loads a third-party script from `umommy.cyou` and its own `/assets/index-*.js`. Its HTML contains
no stream address and no `.m3u8`. No data or list route exists.

### 5.1 Embed pages

**Movie** — `GET https://player.vidzee.wtf/embed/movie/{tmdbId}`: `https://player.vidzee.wtf/embed/movie/550`.

**Episode** — `GET https://player.vidzee.wtf/embed/tv/{tmdbId}/{season}/{episode}`:
`https://player.vidzee.wtf/embed/tv/1399/1/1`.

Version 2 paths:

```http
GET https://player.vidzee.wtf/v2/embed/movie/{tmdbId}
GET https://player.vidzee.wtf/v2/embed/tv/{tmdbId}/{season}/{episode}
```

### 5.2 Media data messages

The page posts `type === "MEDIA_DATA"` messages from origin `https://player.vidzee.wtf`, carrying the
provider's own watch progress per title:

```json
{
  "60574": {
    "id": "60574",
    "type": "tv",
    "title": "Peaky Blinders",
    "poster_path": "/example.jpg",
    "backdrop_path": "/example-backdrop.jpg",
    "progress": { "watched": 2929.3, "duration": 3317.28 },
    "last_updated": 1763218167692,
    "number_of_episodes": 73,
    "number_of_seasons": 8,
    "last_season_watched": "1",
    "last_episode_watched": "2",
    "show_progress": {
      "s1e1": {
        "season": "1",
        "episode": "1",
        "progress": { "watched": 7.05, "duration": 3697.08 },
        "last_updated": 1763218148618
      }
    }
  },
  "550": {
    "id": "550",
    "type": "movie",
    "title": "Fight Club",
    "poster_path": "/example.jpg",
    "progress": { "watched": 957.03, "duration": 8304.72 },
    "last_updated": 1763218088456
  }
}
```

### 5.3 Player messages

```ts
type VidZeePlayerFrame = {
  type: "PLAYER_EVENT";
  data: {
    event: "play" | "pause" | "seeked" | "ended" | "timeupdate";
    currentTime: number;   // seconds
    duration: number;      // seconds
    tmdbId: number;
    mediaType: "movie" | "tv";
    season?: number;
    episode?: number;
  };
};
```

## 6. Side by side

| | VidSrc | VixSrc | VidZee |
|---|---|---|---|
| Key | none | none | none |
| Movie id | IMDb or TMDB | IMDb or TMDB | TMDB |
| Episode | id, season, episode | id, season, episode | TMDB, season, episode |
| Metadata route | `/info` | no | none recorded |
| Latest feeds | yes | no | no |
| Full id lists | yes | catalog lists | no |
| Player messages | status-shaped | event-shaped | event-shaped, plus media data |
| Start position | `startAt` | `startAt` | from its messages |
| Subtitle preference | `ds_lang` | `lang` (audio) | not recorded |
| Colours | not recorded | primary and secondary | not recorded |
| Quality claimed | up to 1080p labels | not recorded | 1080p and 4K |
| Plays as | an embed page | an embed page | an embed page |
| CORS on data | yes | no | no data routes |

## 7. What the checks mean for Giga Stream (2026-10-16)

- **Decision (owner, 2026-10-16):** titles play through the providers' embedded players, starting with
  these three and then the owner's other 47. `14` proves how before it is built.
- **All three serve embed pages only.** Their own documentation (`https://vidsrc.sh/vidsrc/docs/`,
  `https://vixsrc.to/`, `https://vidzee.wtf/#api-docs`, all read on 2026-10-16) offers no route that
  answers a stream address: only embed pages, and for VidSrc and VixSrc lists of what they have. The stream
  is fetched by the provider's own scripts inside the page, and VidSrc's page actively blocks developer
  tools. A stream is never extracted from a provider's scripts (`13` section 5), so these titles cannot
  play in the app's own `<video>`; they play in the provider's embedded player.
- **VidSrc can say what it has.** `/info` answers `200` or `404` per movie, series and episode, with CORS,
  and the id lists cover the whole catalog daily.
- **VixSrc's catalog is usable but heavy** (a 17 MB episode list); it would be read by the backend, never
  by the interface.
- **The pages carry ads and third-party scripts**, which would run inside the app if an embed page were
  used.
- **These are unlicensed services.** VixSrc says its library is scraped from other websites and sells
  custom domains for avoiding ISP blocks and detection; VidSrc's custom domain trades on fewer ads. Whether
  Giga Stream may use any of them is the first question of `13` G3.

## 8. Still to establish

The playback behaviour (popups and navigation, the messages as actually sent, exact movie and episode
identity, start position, subtitles, sandboxing, autoplay, fullscreen, ads, and Electron against Chrome)
is what `14` checks. Rate limits were not met in a handful of requests and are recorded if the PoC meets
them.
