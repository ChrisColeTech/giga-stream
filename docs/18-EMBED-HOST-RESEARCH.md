# 18 - Embed Host Research

**Status: verified live on 2026-10-16** against the owner's list of twenty-nine embed hosts. Every
movie-embed template in section 2 was captured by selecting each source in a real browser on
`ymovies.mom` (its server picker is the owner list's origin) and reading the player iframe it builds
for TMDB `1561726` — so the table records **the addresses a live consumer uses today**, not what a
docs page claims. Section 3 adds parameter detail read from the providers' own docs pages where they
exist. TV shapes follow the same families (`/tv/{tmdb}/{s}/{e}`) and are marked where they differ or
remain unverified. The domain map changes weekly; re-verify before relying on a row.

**Why earlier probes failed (recorded so it is not repeated):** several domains in this table do not
resolve from this machine's shell DNS (`curl`, Node fetch) yet load fine in the owner's browser —
`111movies.com`, `vidking.net`, `autoembed.cc`, `videasy.net` among them. A failed DNS lookup from
the shell is **not** evidence a provider is dead. Verify in a real browser, or through the fileserver,
before retiring a domain.

## 1. Scope and method

The owner supplied thirty embed-host names (section 5). For each: find the service's own API or embed
documentation, verify the embed URL shapes, and record parameters and player messages where documented.
Method, in order: the provider's own docs page (rendered with a real browser where the site is
JS-only), raw HTTP probes of candidate domains, and — where a domain is dead — the community
domain-rotation tracker `EncDecEndpoints` (`github.com/smy778/EncDecEndpoints`, whose README records
current domains and, for the scrapers, their encryption endpoints). A name with no live service and no
tracker entry is recorded **unresolved**, not guessed.

Embed-template notation: `{tmdb}` and `{imdb}` are TMDB/IMDb ids (most hosts accept either for movies;
TV is `{tmdb}/{season}/{episode}` unless noted).

## 2. Summary table — live addresses captured from a real consumer

Each row: the iframe address the ymovies.mom player built when that source was selected (2026-10-16,
movie TMDB `1561726`). `{tmdb}` = TMDB id; `{imdb}` = IMDb id; TV = `{tmdb}/{s}/{e}` unless noted.

| # | Name | Movie embed address (live) | Notes |
|---|---|---|---|
| 1 | Cinezo | `player.cinezo.live/embed/movie/{tmdb}` | "(No Ads)" label in the picker |
| 2 | CineSrc | `cinesrc.st/embed/movie/{tmdb}` | matches the tracker's record |
| 3 | PeeStream | `peestream.in/embed/?tmdbId={tmdb}&type=movie` | query-parameter style; TV presumably `&type=tv&s=&e=` (unverified) |
| 4 | FlaxMovies | `flaxmovies.xyz/embed/movie/{tmdb}` | `.site` is the site, `.xyz` the embed host |
| 5 | MoviesAPI | `moviesapi.to/movie/{tmdb}` | `.club` (the old name) is gone; moved to `.to` |
| 6 | VidLink | `vidlink.pro/movie/{tmdb}` | params in section 3.2 |
| 7 | VidSrc Embed | `vidsrc-embed.ru/embed/movie/{imdb}` | **IMDb id**, not TMDB (observed `tt38672588`) |
| 8 | VidEasy | `player.videasy.net/movie/{tmdb}` | `videasy.to` is the site; the player host is `.net` |
| 9 | 111Movies | `111movies.com/movie/{tmdb}` | alive; does not resolve from this machine's shell DNS |
| 10 | VidZee | `player.vidzee.wtf/embed/movie/{tmdb}` | as `12` |
| 11 | VidSrc | `vidsrc.to/embed/movie/{tmdb}` | `vidsrc.sh` docs, `vidsrc.to` embed host (`12`) |
| 12 | 2Embed | `www.2embed.cc/embed/{tmdb}` | TMDB id in the movie path (not IMDb as older docs said) |
| 13 | Mapple | `mapple.uk/watch/movie/{tmdb}` | a watch page, not a bare embed host; `.tv` is marketing |
| 14 | PrimeSrc | `primesrc.me/embed/movie?tmdb={tmdb}` | query-parameter style |
| 15 | MultiEmbed | `multiembed.mov/?video_id={tmdb}&tmdb=1` | `tmdb=1` flags the id kind; `&s=&e=` for TV |
| 16 | AutoEmbed | `player.autoembed.cc/embed/movie/{tmdb}` | alive on the `player.` host; apex failed our DNS |
| 17 | VixSrc | `vixsrc.to/movie/{tmdb}` | as `12` |
| 18 | VidLove | `player.vidlove.cc/embed/movie/{tmdb}` | as section 3.5 |
| 19 | VidFast | `vidfast.vc/movie/{tmdb}` | params in section 3.3 |
| 20 | Filmu | `embed.filmu.in/movie/{tmdb}` | `.in` embed host |
| 21 | VidCore | `vidcore.net/movie/{tmdb}?theme=%23E50914` | theme param observed; `vidcore.org` is the docs site |
| 22 | VAPlayer | `vaplayer.ru/embed/movie/{tmdb}?skin=netflix&color=ff0000` | skin/colour theming; `vaplayer.ru` also ran VidApi's stream API (`15`) |
| 23 | Vares | `vares.app/movie/{tmdb}` | |
| 24 | VidKing | `www.vidking.net/embed/movie/{tmdb}` | alive in the browser; VidEasy-family embed shape |
| 25 | VidNest | `vidnest.fun/movie/{tmdb}` | embed on the main domain (its JSON API is nonce-guarded, 4.6) |
| 26 | VidSrc.su | `vidsrc.su/movie/{tmdb}?autoplay=true&colour=E50914&…` | full docs in section 3.1 |
| 27 | VidGod | `vidgod.net/movie/{tmdb}` | |
| 28 | VidSrc.me | `vidsrc.me/embed/movie?tmdb={tmdb}` | query-parameter style (its docs page shows the vidsrc.sh path style) |
| 29 | 1Embed | `1embed.cc/embed/movie/{tmdb}` | |

TV shapes were not individually captured for every row (the consumer was on a movie); the standard
`/tv/{tmdb}/{s}/{e}` pattern applies across the path-style hosts and is documented on VidLink,
VidFast, VidSrc.su, VidZee, VixSrc and VidCore (`12`). PeeStream, PrimeSrc, MultiEmbed, VidSrc Embed
and Mapple need a TV-title pass before phase 7 relies on them.

## 3. Verified providers — details

Records below were read off the provider's own rendered docs page today unless a source is named.

### 3.1 VidSrc.su — `vidsrc.su/docs`

- Movie: `https://vidsrc.su/movie/{tmdb|imdb}?parameters` — example `?autoplay=true&colour=00ff9d&backbutton=https://vidsrc.su/&logo=…png`
- TV: `https://vidsrc.su/tv/{tmdb|imdb}/{s}/{e}` — examples `/tv/1396/1/1`, `/tv/tt0903747/1/1`
- Parameters: `autoplay` (bool, default false), `colour` (hex, no `#`, default `00ff9d`), `autonextepisode` (bool, default **true**, TV), `backbutton` (URL), `logo` (URL), `pausescreen` (bool, default true), `idlecheck` (minutes, `0` disables)
- Messages: the player posts **`MEDIA_DATA`** to the parent window: `{ id, type: 'movie'|'tv', title, progress: {…watched time, duration}, last_updated }`, meant to land in the host's `localStorage` (`watch_progress` key). Position units: the docs' sample code stores what arrives; unit not stated — verify against `12`'s seconds rule before trusting.

### 3.2 VidLink — `vidlink.pro` (landing page + documentation section; `vidlink.org` is parked)

- Movie: `https://vidlink.pro/movie/{tmdb}`
- TV: `https://vidlink.pro/tv/{tmdb}/{s}/{e}`
- Anime: `https://vidlink.pro/anime/{malId}/{number}/{sub|dub}`, `?fallback=true` forces the other track
- Parameters: `primaryColor`, `secondaryColor`, `iconColor` (hex, no `#`), `icons` (`default`|`vid`), `title` (bool), `poster` (bool), `autoplay` (bool, default false), `nextbutton` (bool, default **false**; shows at 90 % watched), `player` (`default`|`jw`), `startAt` (seconds; does **not** replace its own saved progress), `sub_file` (direct VTT URL), `sub_label`, `fallback_url` (redirect when a stream fails)
- Combined example: `https://vidlink.pro/tv/94605/2/1?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=false&nextbutton=false`
- Internals: an obfuscated internal API `vidlink.pro/api/b/{data}` exists; the tracker (`EncDecEndpoints`, updated 2025-10-02) encrypts ids for it via `enc-dec.app/api/enc-vidlink`. Not needed for embed playback.

### 3.3 VidFast — `vidfast.vc` (landing-page documentation tabs; `vidfast.pro` Cloudflare-blocks bots)

- Movie: `https://vidfast.vc/movie/{imdb|tmdb}?autoPlay=true`
- TV: `https://vidfast.vc/tv/{imdb|tmdb}/{s}/{e}?nextButton=true&autoNext=true`
- Movie params: `title`, `poster`, `autoPlay`, `startAt` (seconds), `theme` (hex), `server` (named default server), `hideServer`, `fullscreenButton`, `chromecast`, `sub` (`en`, `es`, `fr`, …)
- TV adds: `nextButton` (shows at 90 %), `autoNext` (requires `nextButton`)
- Embed domains: `vidfast.vc` is the one the docs name. The site exposes Events/PostMessage doc tabs (not read today — follow-up when the player messages matter, `14` check 5).

### 3.4 VidCore — `vidcore.org` (docs pages), embeds at `vidcore.created.app`

- Movie: `https://vidcore.created.app/embed/movie/{tmdb}`
- TV: `https://vidcore.created.app/embed/tv/{tmdb}/{s}/{e}`
- Doc pages on the main site: `/free-movie-embed-api`, `/free-tv-show-embed-api`, `/anime-embed-api`, `/tmdb-streaming-api`; no API key required (their FAQ). Player parameters not yet read page-by-page.
- Raw stream API at `vidcore.io` is Cloudflare-protected; the tracker records its encrypt/decrypt pair (`enc-vidcore`/`dec-vidcore`, updated 2026-08-21).

### 3.5 VidLove — `vidlove.cc`

- Movie: `https://player.vidlove.cc/embed/movie/{tmdb}`
- TV: `https://player.vidlove.cc/embed/tv/{tmdb}/{s}/{e}`
- Tagline: "embed any title by TMDB id". Parameters not documented on the page read.

### 3.6 VidBolt — `vidbolt.xyz`

- Movie: `https://vidbolt.xyz/movie/{tmdb}` (example id `1007757` on the page)
- TV shape unverified from the page read; presume `/tv/{tmdb}/{s}/{e}` until checked.

### 3.7 2Embed — `2embed.cc` (`.org` parked/for-sale, `.online` origin down)

- Movie: `https://www.2embed.cc/embed/{imdb}`
- TV: `https://www.2embed.cc/embedtv/{tmdb}&s={s}&e={e}` (paths `/embed/`, `/embedtv/`, `/embedtvfull/` are on the site)
- The long-standing 2Embed shapes; mirrors `2embed.skin`.

### 3.8 MultiEmbed — `multiembed.mov`

- Pure endpoint, no docs site: `https://multiembed.mov/?video_id={tmdb|imdb}&s={s}&e={e}`
- Verified by the endpoint's own error text (`Missing video_id`) and 200 answers for `?video_id=603` and `?video_id=603&s=1&e=1`.

### 3.9 VidSrc family — `vidsrc.sh` (docs `12`), `vidsrc.me`, `vidsrc.su` (section 3.1)

- `vidsrc.me/vidsrc/docs` documents **vidsrc.sh** addresses (`/embed/movie/{imdb}`, `/embed/tv/{tmdb}/{s}/{e}`): it is a front of the same service, as `12` records for the other mirrors (`vidsrc.cc`, `vidsrc.is`, `vidsrc.xyz`).
- `vidsrc.su` is a separate implementation with its own docs and parameter set (section 3.1), not a mirror.

### 3.10 VidZee and VixSrc

- Already fully recorded in `12` (verified live 2026-10-16) and proven in the PoC (`14` section 6.2): VidZee `player.vidzee.wtf/embed/movie|tv/...` with `PLAYER_EVENT`/`MEDIA_DATA` messages; VixSrc `vixsrc.to/movie|tv/...` with `PLAYER_EVENT` (fields nested under `event`), no docs page.

### 3.11 VidEasy — `videasy.to`; VidKing — its alias

- `videasy.net` and `docs.videasy.net` are dead DNS; the live domain is `videasy.to` (tracker, updated 2026-10-11). `vidking.net` is recorded by the tracker as VidEasy's alternative domain and is currently dead DNS itself.
- Embed shapes are the widely used ones (`/embed/movie/{tmdb}`, `/embed/tv/{tmdb}/{s}/{e}`) but were **not** verified live today — the public pages would not load. Its raw stream API (`api.wecollege.net`) is tracker-decoded (`dec-videasy`).
- Community note (`15` issue 62): Videasy needed the `Yuru`/"cdn" server and seeded requests when scraped directly.

### 3.12 CineSrc — `cinesrc.st`

- Embed path recorded by the tracker: `cinesrc.st/embed/…` with encrypted token + next-action headers (`enc-cinesrc`/`dec-cinesrc`, updated 2026-06-09). Not verified live today (Cloudflare). Embed parameter shapes unknown — needs a real-browser pass before phase 7.

## 4. Corrections from the live pass (2026-10-16, second half)

The morning's doc-first research (now superseded where it conflicts) got several "dead" verdicts
wrong because of the shell-DNS issue recorded at the top. Corrections:

- **Alive and verified live:** `111movies.com`, `vidking.net` (as `www.vidking.net`), `autoembed.cc`
  (as `player.autoembed.cc`), `videasy.net` (as `player.videasy.net`), `vidsrc.to`.
- **Moved domains (old → live):** `moviesapi.club` → `moviesapi.to` · `mapple.tv` → watch host
  `mapple.uk` · Cinezo `cinezo.org` → `player.cinezo.live` · FlaxMovies `flaxmovies.site` → embed
  host `flaxmovies.xyz` · Filmu → `embed.filmu.in` · 1Embed → `1embed.cc` (not iembed.codeera.dev) ·
  VidGod → `vidgod.net` · Vares → `vares.app` · PrimeSrc → `primesrc.me` · VidSrc Embed → `vidsrc-embed.ru`
  (IMDb ids) · VAPlayer → `vaplayer.ru` embeds.
- **Parked/for-sale (unchanged):** `vidlink.org`, `2embed.org`, `mapple.pro`, `flaxmovies.com`.
- **VidBolt** (`vidbolt.xyz`) and **PeeStream** (`peestream.in`) are not in the picker's thirty but were
  verified from their own pages earlier the same day; both live.
- **VidNest** (`vidnest.fun`) embeds on the main domain; its JSON API remains nonce-guarded (below).

### 4.6 VidNest — why its API is not simply callable

`vidnest.fun` answers its API (`new.vidnest.fun/{server}/movie/{tmdb}`) with `403 {"error":"missing or
invalid nonce"}` from scripts: the site added an anti-bot nonce after the scraper flows were written
(CinePro's May-2026 code has none). The **embed** (`vidnest.fun/movie/{tmdb}`) is what the picker uses.

## 6. Cross-cutting notes

- **Domain rotation is the norm.** Half of these names changed domains within months. The working
  consumer's picker is the freshest map there is; our `providers` records (backend, `03` 7.2b) carry
  `docs`/`docsReadAt` so re-verification stays cheap, and `17`'s loader reads from those records.
- **Common shapes.** The dominant pattern is `{host}/embed/movie|/movie/{tmdb}` + `/tv/{tmdb}/{s}/{e}`;
  outliers are query-parameter style (PeeStream, PrimeSrc, MultiEmbed, VidSrc.me), the IMDb-id host
  (VidSrc Embed), and the watch-page host (Mapple). A `generic-embed` adapter (`12` section 1.1) with
  per-provider templates covers the whole table.
- **Messages.** Only VidSrc.su (section 3.1) and the PoC trio (`12`) document player messages.
  VidFast's docs advertise an Events/PostMessage tab — read it before relying on progress from it.
- **PoC next steps.** The picker's twenty-nine hosts can go through the `14` checks now: fill
  `data/providers.json` from section 2, run `check.mjs` per provider, and record results in `14`
  section 6 — same gates as the first three.
