# 11 - TMDB API (and OMDb, the second source)

**Status: decisions binding; API facts observed live with the owner's credentials on 2026-10-15, and the
lists, genres, search and series cast again on 2026-10-16. OMDb's site, envelope and full answer shape
observed live with the owner's key on 2026-10-16.** How Giga Stream uses The Movie Database for title
metadata, and OMDb for the facts TMDB does not carry. No product code calls either yet. The owner's
decisions are in sections 5 and 7.

## 1. Access (observed 2026-10-15)

| Item | Value |
|---|---|
| Base URL | `https://api.themoviedb.org/3` |
| Auth | `Authorization: Bearer <API read access token>` (the long v4 token works on every v3 route); `?api_key=<v3 key>` also works but puts the credential in a URL, so it is not used |
| Bad credential | `401`, `status_code` 7 |
| Unknown id | `404`, `status_code` 34 |
| Rate limit | no published number; TMDB describes its ceiling as about 40 requests per second; `429` when exceeded, with no `Retry-After` observed |
| Response caching | `cache-control: public, max-age=N` (roughly 4,000 to 22,000 s for catalog data) and an `etag` |

**The credential.** The owner's two credentials are in `docs/tmdb_apiKey.txt` (in the archive;
gitignored, never committed). At run time the token is an environment variable of **the admin backend
only**, `TMDB_READ_TOKEN`. It never reaches the fileserver, the interface, a document or a log, and it
is sent only in the `Authorization` header.

## 2. Images (observed 2026-10-15)

`GET /configuration` gives `images.secure_base_url` (`https://image.tmdb.org/t/p/`) and the sizes:

| Kind | Sizes |
|---|---|
| poster | w92 w154 w185 w342 w500 w780 original |
| backdrop | w300 w780 w1280 original |
| logo | w45 w92 w154 w185 w300 w500 original |
| profile | w45 w185 h632 original |
| still | w92 w185 w300 original |

An image address is `<secure_base_url><size><file_path>`. The image host needs no credential. The
backend reads `/configuration` and caches it rather than hard-coding sizes. The interface never loads
an image from TMDB: the fileserver's image cache (`03` section 3.11) fetches it and serves it same-origin.

## 3. Endpoints (observed 2026-10-15)

| Need | Endpoint | What it returns |
|---|---|---|
| Search | `GET /search/multi?query=&include_adult=false&page=` | `{ page, results, total_pages, total_results }`; each result has `media_type` (`movie`, `tv`, `person`), `id`, `title` or `name`, `release_date` or `first_air_date`, `overview`, `poster_path`, `genre_ids`, `popularity`, `vote_average` |
| Movie | `GET /movie/{id}?append_to_response=credits,external_ids,videos` | genres (id and name), `runtime` in minutes, `imdb_id`, `popularity`, `vote_average`, `credits.cast[]` |
| Series | `GET /tv/{id}?append_to_response=credits,external_ids` | `name`, `number_of_seasons`, `number_of_episodes`, `seasons[]` (`season_number`, `episode_count`; season 0 is Specials), `popularity` |
| A season's episodes | `GET /tv/{id}/season/{n}` | `episodes[]` with `season_number`, `episode_number`, `name`, `air_date`, `still_path`, `runtime`, `overview` |
| IMDb id to TMDB id | `GET /find/{imdb_id}?external_source=imdb_id` | `movie_results`, `tv_results`, `tv_episode_results`, ... |
| Genre names | `GET /genre/movie/list`, `GET /genre/tv/list` | lists carry only `genre_ids`, so these are cached |
| Popular and trending | `GET /movie/popular`, `GET /tv/popular`, `GET /trending/{all,movie,tv}/{day,week}` | 20 per page, each with `popularity` |
| Related | `GET /movie/{id}/recommendations`, `GET /tv/{id}/recommendations` | 20 per page |
| Lists by sort, genre and year (observed 2026-10-16) | `GET /discover/movie`, `GET /discover/tv` | `sort_by` (`popularity.desc`, `primary_release_date.desc` or `first_air_date.desc`, `title.asc` or `name.asc`), `with_genres`, `primary_release_year` or `first_air_date_year`, `vote_count.gte`; the usual page shape |

**Also observed 2026-10-16** (read-only calls with the owner's token):

- **Paging stops at page 500.** Page 501 is `400`, `status_code` 22. Long lists report more pages than
  can be read (`total_pages` 1001), so the backend caps paging at 500.
- **Newest by release date is mostly obscure titles** (popularity 0, released today). With
  `vote_count.gte=50` *(default)* it lists recognisable recent films; the backend applies that floor to
  the release-date and name sorts.
- **Movies and series have different genre lists** (movies `Action`, `Science Fiction`; series
  `Action & Adventure`, `Sci-Fi & Fantasy`), with different ids. With both kinds shown, a genre filter
  applies to the kind it belongs to.
- **A series' cast** comes with `GET /tv/{id}?append_to_response=credits,external_ids` (14 names for
  Game of Thrones).
- `/authentication`, `/trending/all/week`, both genre lists and `/search/multi` answered as section 3
  says.
| Credential check | `GET /authentication` | `{ "success": true }` |

A title has both ids: `id` is TMDB's and `imdb_id` (movies) or `external_ids.imdb_id` (series) is
IMDb's. The backend keeps both, since providers look titles up by either.

## 4. What Library takes from it

In the terms of `06` sections 4 and 5; the fields are `BackendTitle`, `TitleDetail` and `Episode` in `03`
sections 3.6 and 7.4.

| Library shows | From TMDB |
|---|---|
| A title's kind | `movie` or `tv` |
| Title and year | `title` or `name`; the year of `release_date` or `first_air_date` |
| Poster, backdrop | `poster_path` at w500, `backdrop_path` at w1280, through the image cache |
| Plot and rating | `overview`; `vote_average` (0 to 10) |
| Genres | the names from the detail call (lists map `genre_ids` through the cached genre lists) |
| Cast chips | the first ten `credits.cast[].name` |
| Runtime | `runtime` (minutes) for a movie |
| Seasons and episode counts | `seasons[]` for a series, mapped by the backend (`season_number` to `season`, `episode_count` to `episodeCount`); season 0 Specials and empty seasons are left out (`03` section 7.4) |
| An exact episode | `season_number`, `episode_number`, `name`, `air_date`, the still at w300 |
| The Trending sort | `popularity`, with its source (TMDB) and the time it was read |
| Related titles | the title's `/recommendations`, first page, in TMDB's order |

The Genre and Year filters' choices are computed from the titles shown, not fetched from TMDB.

**Trending.** `06` section 4.3 offers the Trending sort only when the backend supplies a real current
popularity signal. TMDB's `popularity`, read on demand and cached for hours, is that signal. If TMDB
cannot be reached and the cached score is older than seven days, the sort is not offered.

**Related (decided).** The Player's related band (`06` section 5.5) uses TMDB's recommendations, with
the basis `TMDB`. When TMDB has none for a title, the band falls back to genre and year over the
catalog.

## 5. Where it runs (decided by the owner, 2026-10-15)

- **On demand, through the admin backend as a caching proxy.** There is no import job and no draft
  and publish step for TMDB data. The backend calls TMDB when a title is added and when its details,
  seasons or recommendations are asked for, turns the answer into Library's shapes and caches it. The
  credential stays in the backend, and one shared cache keeps the request rate low.
- **Which titles.** Library browses and searches TMDB itself through the backend (`03` section 7.4): any
  movie or series TMDB has. Each title and episode gets its stream address from the backend's rule (`03`
  section 7.5).
- **Freshness in the backend's cache.** Lists and popularity: hours. Titles, credits, seasons, episodes,
  genres and recommendations: days. Search: not cached past the request. Nothing is kept longer than six
  months (section 6). When TMDB cannot be reached the backend answers from its cache.
- **No catalog cache in the fileserver.** The fileserver keeps no copy of TMDB or catalog data. It
  passes the backend's answers through, keeps them in memory for the request or the session, and
  caches only images. It never calls TMDB. When the backend cannot be reached, Library's title regions
  are skeletons, not stale titles (`02` section 7).
- **Rate.** The backend sends at most about 5 requests per second to TMDB, backs off on `429`, and
  merges simultaneous requests for the same thing into one call.
- **The routes** are the backend's title routes (`03` section 7.4) and the fileserver's pass-through
  (`03` sections 3.5 and 3.6).

## 6. Terms that bind the product

From TMDB's API terms of use, as read on 2026-10-15 (not legal advice):

- **Non-commercial only** without a separate written agreement with TMDB. Charging for an app that uses
  TMDB data, advertising or subscription revenue tied to it, or training AI or ML models on it is
  commercial. Giga Stream has no accounts, billing or ads (`00`), so it is within the free terms; adding
  any of them needs a TMDB agreement first.
- **Attribution.** The TMDB logo, less prominent than the app's own marks, and the notice "This product
  uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." It sits in
  Settings, About (`06` section 6.2). The logo comes from TMDB's brand page.
- **Caching.** TMDB data may not be cached for longer than six months. When the licence ends, all TMDB
  content is deleted.
- **No** AI or ML training, derivative APIs, reselling or excessive bandwidth.
- **Fixtures.** Recorded TMDB responses are never committed. Tests use hand-written fixtures in the same
  shape; any real capture stays in a gitignored folder.

## 7. OMDb — the second source, for the details TMDB lacks (added 2026-10-16)

OMDb (the Open Movie Database, `omdbapi.com`) answers by **IMDb id** with facts TMDB either has not or
carries differently: the age rating, Metascore, the Rotten Tomatoes score, `imdbRating` and votes,
awards, box office, director and writer, the full plot in one paragraph, language and country. TMDB
stays the one source for everything list-shaped — browse, search, genres, popularity, posters, seasons,
episodes, recommendations. OMDb only **enriches a detail**, and only after TMDB's detail (which carries
`imdb_id`, so the id to ask OMDb for is already in hand).

### 7.1 Access (observed live with the owner's key, 2026-10-16)

| Item | Value |
|---|---|
| Base URL | `https://www.omdbapi.com/` (TLS; the site's example links say `http://` but https answers) |
| Auth | `?apikey=<key>` — a query parameter only; there is no header form, so the key is in the URL and must be redacted from every log (`03` section 7.13's never-a-token rule) |
| The owner's key | in `docs/tmdb_apiKey.txt`, the one credentials file, on its OMDb line; at run time `OMDB_API_KEY`, backend only |
| Free tier | 1,000 calls a day (the owner's plan); the paid tiers raise it |
| Errors are `200`s | a refusal is `{"Response":"False","Error":"..."}` — observed: `No API key provided.`, `Invalid API key!`, and a miss by id is `Error getting data.`; the client reads `Response`, never the status code |
| Key lookups | `?i=tt1285016` (IMDb id); `?t=<title>` (+ `&y=` year) also exists but is not used — ids only, never a title string |

### 7.2 What the backend takes from it (fields observed 2026-10-16: The Matrix `tt0133093`, Game of Thrones `tt0944947`)

One answer carries: `Title, Year, Rated, Released, Runtime, Genre, Director, Writer, Actors, Plot,
Language, Country, Awards, Poster, Ratings[], Metascore, imdbRating, imdbVotes, imdbID, Type, DVD,
BoxOffice, Production, Website, Response`. Examples observed: The Matrix — `Rated` R, `Metascore` 73,
`imdbRating` 8.7, `Ratings[]` from Internet Movie Database, Rotten Tomatoes and Metacritic,
`Awards` "Won 4 Oscars. 42 wins & 52 nominations total", `BoxOffice` $177,559,005, `Director` "Lana
Wachowski, Lilly Wachowski"; Game of Thrones — `totalSeasons` 8, `Type` series, `Year` "2011–2019".

| Field | Library shows (`06` section 4.4, `03` section 7.4's `BackendTitle`) |
|---|---|
| `Rated` | the age rating chip on a title's detail |
| `Ratings[]` (Internet Movie Database, Rotten Tomatoes, Metacritic), `Metascore`, `imdbRating`, `imdbVotes` | the detail's ratings block; the interface's own `rating` stays TMDB's `vote_average` |
| `Plot` with `plot=full` | the detail's plot when TMDB's `overview` is thin (never replaces a present one) |
| `Director`, `Writer`, `Actors` | detail facts beside the TMDB cast |
| `Awards`, `BoxOffice` | the detail's facts block |
| `Language`, `Country` | detail facts |
| `totalSeasons`, `Type` | cross-checks only; TMDB owns seasons and the kind |
| `Poster` | **not used** — posters come from TMDB through the image cache (`03` section 3.11) |

### 7.3 How it runs (the owner's decision, 2026-10-16)

- **OMDb is a gap filler, not an enrichment of every title** (owner, 2026-10-18: "omdb should be used when we dont get the data
  from tmdb"). The Library fill's `details` phase stores a title's TMDB detail; ONLY IF that stored detail has a gap, an OMDb key
  is configured and an `imdb_id` exists, it makes **one** OMDb call. A gap is exactly one of: an empty `overview` (OMDb `Plot`,
  `plot=full`), no runtime (OMDb `Runtime`), no genres (OMDb `Genre`, mapped to the stored genre dictionary by name). OMDb fills
  only the empty fields and never replaces a present one; the answer's fields of section 7.2 are kept as the payload's `omdb`
  object for that title. A title whose TMDB detail has no gap makes no OMDb call. The age rating, ratings block, awards and box
  office rows of 7.2 are not shown anywhere today (nothing reads them), so they are not collected for every title. A title OMDb
  cannot answer is recorded (`omdb_failed_at`) and asked again only after the freshness window; the job's counts carry `enriched`
  (titles a gap was filled for).
- **The quota is a budget, not a rule.** Because only gap titles call OMDb the daily 1,000 is rarely reached. The backend counts the
  day's calls and stops calling (leaving the gap) when the count nears the 1,000; the next run asks again, from the next UTC day.
  A `Request limit reached.` answer is treated the same way, never as an error a person sees.
- **The sync does not call OMDb.** The catalog sync (`03` section 7.6b) walks TMDB's lists only; OMDb
  spend follows what is actually opened.
- **Nothing falls back to OMDb alone.** A title without an `imdb_id`, or an OMDb miss
  (`Incorrect IMDb ID.`), is simply served TMDB-shaped; OMDb never introduces a title, and never
  replaces a TMDB fact.
- **Terms.** OMDb's content is CC BY-NC 4.0: non-commercial (already binding via section 6's TMDB
  terms), with attribution — a credit line and licence link beside the TMDB notice in Settings ▸ About
  (`06` section 6.2). Images (its Poster API) are not used: posters come from TMDB through the image
  cache. Fixtures follow section 6's rule: hand-written, never a recorded OMDb answer.
