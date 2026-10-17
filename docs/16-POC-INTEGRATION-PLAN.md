# 16 - PoC Integration Plan: providers as a selectable source

**Status: plan, 2026-10-16.** This document answers one question: given the PoC in `14` (the
`src/mockup` program) and the CinePro Core API in `15`, **how does each source become a provider
the user can choose from in Giga Stream?** It is a plan, not a build. It records what the PoC has
already proved, what the product needs that the PoC does not have, and the concrete steps to get
from "one provider in a test iframe" to "a per-title list of providers the user picks from."

---

## 1. The core distinction: provider vs source

The PoC treats a **provider** as a single upstream service with one embed-address template
(`vidsrc`, `vixsrc`, `vidzee`). CinePro Core treats a **provider** as a scraper class and a
**source** as one playable stream returned by a provider. The two wordings collide, and the
product must separate them cleanly before any UI is built.

| Word | PoC (`14`) | CinePro Core (`15`) | Product (this doc) |
|---|---|---|---|
| **Provider** | a named upstream service in `providers.json` (e.g. `vidsrc`) | a scraper class in `src/providers/<name>/` (e.g. `VidSrcProvider`) | an administered record in the backend; the unit the user picks |
| **Source** | not used (one provider = one embed address) | one playable stream in `SourceResponse.sources[]` (a proxy URL, type, quality, audio, provider) | a concrete playable address for a title; what the Player actually loads |
| **Embed address** | the provider's iframe URL | not a first-class concept (CinePro returns proxy URLs, not embeds) | how an embed-style provider is played |
| **Stream address** | not a first-class concept | the proxy URL in `Source.url` | how a stream-style provider is played |

The product's definition:

- A **provider** is an administered backend record (name, kind, address template, allowed origins,
  message shape, enabled, preference order) — the same shape the archive backend already had
  (`12` section 1.1), carried forward.
- A **source** is what a provider answers for a title: either an **embed address** (played in an
  iframe) or a **stream address** (played in the app's own `<video>`). One provider may yield
  several sources (CinePro's fan-out, section 15 §9.3); the product dedups and presents them.
- "Each source is a provider we can choose from" means: **for a given title, the user sees a list
  of providers (and, where a provider offers more than one usable source, the best one per
  provider) and picks which to play.** The pick is per title, stored, and drives the Player stage.

## 2. What the PoC already proves

The PoC (`src/mockup`) has verified, against the real services, the mechanics the product will
rely on. These are the building blocks the integration reuses:

| Concern | Where in the PoC | What it proves |
|---|---|---|
| **Provider record shape** | `data/providers.json` | a provider is `id`, `name`, `movie`/`episode` templates, `params` (`startAt`, `subtitles`), `origins`, `messages`, `availability`, `allowHosts` |
| **Building the address** | `js/providers.js` `embedUrl()` | `{tmdbId}`/`{season}`/`{episode}` templating plus documented `startAt` and `subtitles` params |
| **Hosting the embed** | `js/embed.js` | a 16:9 `<iframe>` in the stage with `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`, `sandbox="allow-scripts allow-same-origin allow-presentation"` in sandboxed mode |
| **Decoding player messages** | `js/messages.js` | `postMessage` from the documented origin, decoded per provider's documented shape, position/duration in seconds |
| **Network containment** | `network-rules.cjs`, `data/network.json` | ad hosts blocked by resolver rules; strict mode allows only the provider's own and video hosts |
| **Availability** | `js/availability.js` | a provider's documented "does it have this title" route, where one exists |
| **Per-provider results** | `js/results.js`, `check.mjs` | one JSON result per provider per run, with checks, messages, events, ad-blocks |

What the PoC has **not** done: it never shows more than one provider at a time for a title, it has
no backend (TMDB ids are typed in), it does not handle CinePro's proxy-URL sources, and it does
not persist a per-title provider choice. Those gaps are what sections 4–8 close.

## 3. The two provider families

CinePro Core's providers split into two families that the product must treat differently. The
PoC only exercised the first family.

### 3.1 Embed-style providers

The provider offers an **embed page** that the user watches inside the provider's own player.
The product loads that page in an iframe in the Player stage and reads the provider's documented
messages. This is exactly what the PoC does.

Examples: VidSrc, VixSrc, VidZee (the three in `12` and the PoC). Their `providers.json` entries
carry an `movie`/`episode` template, an `origins` list, a `messages` shape, and (optionally) an
`availability` route.

How they are played: an `<iframe>` in the stage (section 5.1). Progress and resume come from the
provider's `startAt` parameter and its `postMessage` reports.

### 3.2 Stream-style providers

The provider answers a **stream address** — in CinePro, the proxy URL in `Source.url` — that the
app's own `<video>` (or an HLS/DASH instance) plays directly, like a channel. No iframe, no
provider player.

Examples: any CinePro provider whose sources are HLS/MP4 manifest URLs (VidApi, CineSu, Icefy,
the fan-out providers in `15` §9.3). CinePro's proxy already rewrites manifests and forwards
`Range` headers (section 15 §4), so the app can seek and stream without further work.

How they are played: the app's own `<video>` with the proxy URL (section 5.1). Progress and resume
are the app's own (it owns the media element), so no provider messages are needed.

**Why both:** the owner's decision (`14` §1, `03` §7.5) is that titles play through the provider's
own embedded player where the provider only offers an embed page, but `12` §7 and `14` §5 note that
providers documenting a stream address "could play in the app's own `<video>` like a channel." The
product supports both families and lets the user choose, which is precisely what "each source is a
provider we can choose from" asks for.

## 4. The provider model (backend)

The admin backend holds provider **definitions** as administered records. This carries forward the
archive backend's shape (`12` §1.1) and the PoC's `providers.json`, extended for the two families:

| Field | Type | Notes |
|---|---|---|
| `id` | string | machine-readable, unique (e.g. `vidsrc`, `vixsrc`, `cinepro:vidapi`) |
| `name` | string | display name |
| `kind` | `embed` \| `stream` | which family (section 3) |
| `movieTemplate` | string \| null | `https://.../embed/movie/{tmdbId}` (embed) or a CinePro source selector (stream) |
| `episodeTemplate` | string \| null | `.../{tmdbId}/{season}/{episode}` |
| `startParam` | string \| null | the provider's documented start-position parameter (e.g. `startAt`) |
| `subtitleParam` | string \| null | the provider's documented subtitle parameter (e.g. `ds_lang`) |
| `origins` | string[] | origins allowed to post messages (embed) |
| `messageShape` | string \| null | the documented message shape to decode (embed) |
| `availability` | `{movie, episode}` \| null | documented availability routes |
| `allowHosts` | string[] | hosts allowed in strict network mode |
| `enabled` | boolean | on by default or not |
| `order` | number | preference order for auto-selection and the picker's default sort |
| `source` | `cinepro` \| `direct` | where the address comes from (CinePro API vs a direct template) |

For **CinePro-backed** providers, `source` is `cinepro` and the backend does not store a template —
it calls CinePro's `/v1/movies/{id}` or `/v1/tv/{id}/seasons/{s}/episodes/{e}` and takes the
matching `Source` from `sources[]` (section 15 §3.5). The provider's `id` matches CinePro's
`provider.id`. For **direct** providers (the PoC's three), the template is stored and the address
is built client-side or server-side by templating.

A title's playable providers are computed on every title/episode the backend answers:

1. **Direct embed providers** whose template applies (movie or episode) and that are enabled.
2. **CinePro providers** for which the CinePro response returned at least one source with a
   playable type (`hls`, `mp4`, `dash`, …) for that title/episode.

The result is the per-title **provider list** the user picks from (section 6).

## 5. The Player stage (both families)

`06` §5.3 currently says a provider's title plays in the provider's embedded player, in place of
the `<video>`, and that the details are "written here from the results of `14`." This section
specifies that for both families.

### 5.1 Embed-style (iframe)

- The stage hosts a 16:9 `<iframe>` (the PoC's `embed.js` behaviour) with
  `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"` and `referrerPolicy="origin"`.
  Product frames have no `sandbox` attribute in either runtime (owner, 2026-10-17). The PoC's optional
  sandbox test is historical evidence, not a product requirement.
- **Progress** is read from the provider's `postMessage` reports (decoded by `messageShape`),
  converted from seconds to milliseconds, and written to the watch state on the same cadence the
  app uses elsewhere (`06` §5.3: about every 30 s, and on pause/end/seek/tab/close).
- **Resume** passes the last watched position as the provider's `startParam` in the embed address.
- **Fullscreen** is the stage; the provider's own fullscreen (if any) fills the window and returns.
- **Retry** re-creates the iframe with a fresh address.
- **Clean stop** removes the iframe (src to `about:blank`) so picture and sound stop at once.

### 5.2 Stream-style (the app's own `<video>`)

- The stage shows the app's own `<video>` (or HLS instance) pointed at the provider's proxy URL —
  exactly as a channel plays on Live (`06` §3.1).
- **Progress** and **resume** are the app's own (it owns the media element), so no provider
  messages are needed.
- **Retry** re-sets the source; if the proxy URL has expired, the backend is asked for a fresh
  source (CinePro: `GET /v1/refresh/{responseId}` then re-request, section 15 §3.4).

### 5.3 What the stage shows around the media

Both families keep the same stage toolbar (`06` §5.3): a media-kind icon, the title with the
episode/file name beneath, and **Retry**, **Reveal in Library**, **Fullscreen** on the right.
For embed-style, the toolbar's controls that depend on the app owning the media element (seek,
volume) are disabled and their reason is the tooltip; playback itself is the provider's. For
stream-style, all controls work as on Live.

## 6. Choosing a provider (the user-facing piece)

This is the direct answer to the question. A title's playable providers are presented to the user
as a selectable list; the pick is stored and drives the Player.

### 6.1 Where the choice lives

| Surface | Control | Behaviour |
|---|---|---|
| **Player, Stage toolbar** | a **Provider** chip showing the active provider's name | opens a picker of the title's playable providers; the active one is highlighted |
| **Player, Details (right)** | a **Source / Provider** row in the Overview block | the same picker, inline; shows the active provider, its kind (embed/stream), quality, and audio |
| **Title information popup** | a **Provider** row | the same picker, for choosing before or without opening the Player |

The chip/row is absent when the title has exactly one playable provider (nothing to choose). It is
present when there are two or more.

### 6.2 The picker

A compact popup listing the title's playable providers, each row showing:

- the provider's **name**
- its **kind** glyph (embed or stream)
- **quality** and **audio** where known (CinePro sources carry both; embed providers show the
  provider's documented quality if any)
- a **check** on the active provider

Selecting a row:

- sets that provider as the active source for the title (stored per title, section 6.3)
- if a different family is chosen (embed ↔ stream), the stage swaps between the iframe and the
  app's `<video>` (section 5)
- if the provider has more than one usable source for the title, the **best** (highest quality, or
  the user's preferred audio) is used; the user can open a sub-list to pick another

The picker's order is the provider `order` (section 4), with the active provider pinned to the top.

### 6.3 What is stored

A per-title **source preference** is stored in the backend (it is user data, not media):

| Field | Notes |
|---|---|
| `titleId` / `episodeId` | the title (and episode, for series) the preference is for |
| `providerId` | the chosen provider |
| `sourceUrl` | the concrete proxy/embed address chosen (stream-style) or null (embed-style, rebuilt from the template) |
| `updatedAt` | when the pick was made |

This is separate from the watch progress (which is per playback) and from the provider
definitions (which are global). It lets the app remember "the user prefers VidZee for this title"
and re-apply it on the next open.

### 6.4 Auto-selection (no explicit pick)

When the user has not chosen, the app selects by the provider `order` (section 4): the first
enabled provider that can play the title. For CinePro-backed titles, this is the first provider in
the preference order whose sources CinePro returned. The auto-selected provider is shown in the
chip so the user can see what was chosen and change it.

## 7. How the PoC becomes the product

The PoC's modules map onto the product's modules. Nothing in the PoC is thrown away; it is
generalised.

| PoC module | Becomes (in the product) | Change |
|---|---|---|
| `data/providers.json` | backend provider definitions (section 4) | moves server-side, administered; gains `kind`, `order`, `source` |
| `js/providers.js` `embedUrl()` | the backend's address builder (or client for direct providers) | same templating; for CinePro, replaced by the `/v1/...` call |
| `js/embed.js` | the Player stage's embed host (`06` §5.3) | reuses the iframe rules verbatim |
| `js/messages.js` | the Player stage's message decoder (`06` §5.3) | reuses the decode table; gains the product's message-to-progress pipeline |
| `js/availability.js` | the backend's per-provider availability check | same routes; used to mark a provider available/unavailable for a title |
| `network-rules.cjs`, `data/network.json` | the product's network policy (`01`, `02`) | the same ad-host rules and strict mode become the app's frame network policy |
| `js/picker.js` (provider + title) | the Player's provider picker + episode browser (`06` §5) | the provider picker is new; the title/episode picker already exists as the episode browser |
| `js/results.js`, `check.mjs` | kept as a dev harness | the per-provider result format becomes the acceptance check for each provider going live |
| `build-providers.mjs` (new) | the PoC + product provider generator | derives `providers.json` from the core's provider classes (`15`); the single source of truth for the generated block |

The PoC's **checks** (`14` §4) become the **per-provider go-live gate**: a provider is enabled in
the product only when it passes checks 2, 3, 5 and 7 in Electron (and, for embed-style, 12 and 14).
`13` section 5's decision about "reaching into a provider's player" stays as-is; this plan does not
change it.

## 8. Per-provider plan (the owner's other 47)

`14` §5: once the three pass, the owner supplies the other providers (name and documentation
URL). Each goes through the same path:

1. **Read the docs first** (check 1) and write the provider definition (section 4). Classify it:
   embed-style or stream-style (section 3).
2. **Add it to the PoC** (`providers.json`) and run the checks (`14` §4). Record the result.
3. **Enable it in the product** once it passes the go-live gate (section 7), with its `order` set
   by the owner.
4. For **CinePro-backed** providers, no PoC run is needed for the stream family — the provider is
   enabled when CinePro returns a playable source for a title. The PoC run is needed only for
   embed-style providers and for confirming message shapes.

Providers that document a stream address (rather than an embed page) are marked as stream-style and
play in the app's own `<video>` (`14` §5), which is the path that scales to all of CinePro's
fan-out sources without an iframe per provider.

### 8.1 Built: the core's 17 providers are in the PoC (2026-10-16)

The owner's other providers are the provider classes in CinePro Core (`15`), so they are generated
into the PoC rather than hand-written:

- `build-providers.mjs` reads the core's `src/providers/` and emits one `providers.json` entry per
  provider class (14 generated; the 3 hand-written embed providers are kept verbatim). It verifies
  each core provider folder exists before emitting, so a stale spec is caught, not silently
  written. Running `node build-providers.mjs` re-derives the generated block from the core.
- The PoC now plays **both families** (section 3): `js/providers.js` `resolveUrl()` returns an
  embed address for embed providers and the provider's documented stream endpoint for stream
  providers; `js/embed.js` hosts the embed in an iframe (unchanged) or, for a stream provider,
  fetches the endpoint and reports whether it answers a playable manifest/file in place of an
  iframe (it does not host a third-party player — `13` §5).
- The picker shows the family next to the title (`js/picker.js`), and the generated entries carry
  `source: cinepro`, the provider's `base`, `origins`, `kind`, and `enabled` from the core.

The remaining 33 of the owner's 47 (those not in the core) are added to the same generated block
once the owner supplies their documentation URL and family.

## 9. Open decisions

These are the points the owner must settle before phase 7 of `08` builds title playback; they are
flagged, not assumed.

1. **Default family.** When a title is playable by both an embed-style and a stream-style
   provider, which is the default? (This plan's answer: the higher-`order` provider, regardless of
   family; the user can switch.)
2. **Per-episode vs per-series preference.** Is the provider pick stored per episode (so each
   episode can use a different provider) or per series (one pick for the whole series)? This plan
   stores it per episode, with a per-series default inherited downward.
3. **CinePro vs direct for the same upstream.** If a provider is reachable both as a direct embed
   (PoC-style) and through CinePro (proxy stream), is it one provider with two sources or two
   providers? This plan treats it as one provider (the upstream) with a preferred family, but the
   picker can show both sources.
4. **Frame policy resolved by the owner, 2026-10-17.** No iframe sandbox in either runtime. Electron
   retains its ad blocker and main-process guards; browser runtime reports `unprotected`. The renderer
   process sandbox and context isolation remain enabled and are not iframe attributes.
5. **Resume across families.** If the user switches from an embed-style provider to a stream-style
   one mid-title, does the resume position carry over? This plan says yes (it is the title's watch
   progress, not the provider's), but the embed provider must accept a `startParam` to honour it.

## 10. Not in this plan

- The live-stream side (`10`): channels are unaffected; this is titles only.
- Provider discovery or admin UI: the provider definitions are administered records (section 4);
  how they are edited is a separate surface (`06` §6 has no provider section — "providers are the
  backend's").
- Extracting a stream from an embed provider's player: that is `13` §5's explicit non-goal;
  embed-style providers are played as the provider offers them.
- The backend's CinePro deployment: this plan assumes a CinePro instance is reachable (section 15)
  but does not specify how it is hosted or configured.
