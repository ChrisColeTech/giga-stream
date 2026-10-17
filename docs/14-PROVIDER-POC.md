# 14 - Provider Playback Proof of Concept

**Status: specified 2026-10-16; not built.** A small, separate program that proves, against the real
services, how titles play from providers before any of it is built into Giga Stream. It starts with the
three providers in `12` (VidSrc, VixSrc, VidZee); once they work, the owner's other 47 providers go
through the same checks. Its results decide the title-playback parts of `03`, `06` and `13`.

## 1. Why

`12` section 7: all three providers offer **embed pages only**. Their own documentation has no route that
answers a stream address, so a title cannot be handed to Giga Stream's `<video>` as a channel is. The
owner's decision (2026-10-16): titles play through **the provider's own embedded player**, hosted inside
the app's Player stage. Nothing is extracted from a provider's player: the app loads the embed page the
provider offers and reads only the messages the provider documents.

Every behaviour the product will rely on is proved here first, from each provider's own documentation
and a real run, so nothing is designed on an assumption.

## 2. What it is

Plain HTML, CSS and JavaScript in `src/mockup`, laid out like Giga Images' mockup
(`D:\Projects\giga-images-poc\src\mockup-v2`): a near-empty `index.html`, the markup in partials, one
stylesheet per area pulled in by `css/styles.css`, and one ES module per concern.

```text
src/mockup/
  index.html            loads css/styles.css and js/load-partials.js, nothing else
  html/                 the partials: titlebar, picker, stage, logs, checklist, statusbar
  css/                  styles.css (imports only), tokens.css, base.css, one file per area
  js/                   load-partials.js, app.js, and one module per concern (providers, embed, messages,
                        guards, availability, checklist, results)
  data/providers.json   every provider under test: its documentation URL and its address templates
  serve.mjs             a small static server on 127.0.0.1 (the page needs a real origin, not file:),
                        which also saves results
  electron/main.cjs     the Electron shell: one window on the same page, popup and navigation guards
  electron/preload.cjs  passes the guards' reports to the page
  check.mjs             drives the page in headless Chrome over DevTools: loads each provider and title,
                        waits, screenshots the stage and saves the logs
  results/              one JSON result per provider per run, and screenshots (gitignored)
```

- It is never packaged and imports nothing from the three programs.
- It runs in Chrome (the browser case) and in Electron (the desktop case), because they differ in popups,
  navigation and autoplay.
- It calls no Giga Stream server. TMDB ids are typed in.

### 2.1 `data/providers.json`

One entry per provider, written from that provider's own documentation, which is read first:

```json
{
  "id": "vidsrc",
  "name": "VidSrc",
  "docs": "https://vidsrc.sh/vidsrc/docs/",
  "movie": "https://vidsrc.sh/embed/movie/{tmdbId}",
  "episode": "https://vidsrc.sh/embed/tv/{tmdbId}/{season}/{episode}",
  "startAt": "startAt",
  "origin": "https://vidsrc.sh",
  "messages": "vidsrc-player-event",
  "availability": "https://vidsrc.sh/info/movie/{tmdbId}.json"
}
```

`startAt` names the provider's start-position parameter, if it has one; `messages` names the documented
message shape (`12` sections 3.6, 4.4, 5.3); `availability` is a documented "does it have this title"
route, if there is one.

### 2.2 The test page

| Part | Does |
|---|---|
| Picker | provider, movie or episode, TMDB id, season, episode, start position, sandboxed or not |
| Stage | a 16:9 `<iframe>` with the built embed address; `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`; in sandboxed mode `sandbox="allow-scripts allow-same-origin allow-presentation"` (no popups, no top navigation) |
| Message log | every `postMessage` received: time, origin, raw data, and, when it matches the provider's documented shape, the position and duration converted to milliseconds |
| Event log | the frame's load, every attempted popup and navigation (Electron reports them), fullscreen changes |
| Availability | the provider's availability answer for the chosen title, when it has a route the page can call |
| Checklist | the section 4 checks for the loaded provider: pass, fail or a note each, saved with the logs as that provider's result |

### 2.3 Network containment

On 2026-10-16 the providers' embed pages called ad exchanges and popunder networks as soon as they
loaded; Malwarebytes flagged them and stopped the run. Since then (`network-rules.cjs`, `data/network.json`):

- **Ad hosts are never contacted (owner, 2026-10-16).** A host is blocked when any part of its name starts
  with `ad` (`adexchanger.com`, `ad.doubleclick.net`, `x.adnxs.com`) or its name contains `ads`
  (`googleads.g.doubleclick.net`). The name never resolves (Chrome's and Electron's host resolver rules),
  so no connection is made from any frame or worker; Electron also cancels the request before it is sent
  and reports it.
- **A name pattern does not catch every ad host** (VidZee's player loads a script from `umommy.cyou`).
  Strict mode (`check.mjs --strict`, `POC_STRICT=1` in Electron) refuses every host except the PoC's own
  page, the provider's origins and its `allowHosts` in `providers.json`. A host is added to `allowHosts`
  only when it serves the player or the video, never an ad, popunder or tracking host.
- Every host a provider's page asks for is recorded, as contacted or refused, with each run's result.
- Product integration strengthens the PoC's best-effort renderer injection: Electron receives the active
  source's exact frame policy through a named preload capability, enforces nested origins in the main
  process and injects its own static dialog no-ops. Cross-origin `contentDocument` access is never assumed.
- Whether a provider plays with ad hosts refused, and in strict mode, is part of check 14.
- **The blocker fails closed (2026-10-16).** When the blocker's lists cannot load (first launch with no
  internet), the app no longer starts without the blocker ready. `network-rules.cjs` `mayContact` and
  `hostResolverRules` take a `failClosed` flag that applies the same deny-everything-except-allowed rule
  as strict mode, so provider players cannot reach the network until the blocker is ready (`check.mjs`
  passes `failClosed` when the lists are absent).
- **The browser case is unprotected (2026-10-16).** In a plain browser there is no Ghostery and no
  main-process guards; only the sandboxed frame and the frame guard (section 2.4) contain it. The
  statusbar shows `unprotected` in the browser case and `guarded` in Electron. Whether provider titles
  are refused in the browser, or the browser case always uses the sandboxed frame, is a product decision
  (`16` section 9, open decision 4).

### 2.4 Frame and dialog containment

Three things still got through the network rules (the ad frames and dialog boxes load from hosts the
resolver rules do not deny, or run inside an already-loaded frame). The fixes:

- **Nested ad frames.** VidSrc's player loads an ad frame (`stellarconductornexus.com`) inside itself;
  today frames inside the player are left alone. The fix is a per-provider list of the frame origins its
  player really uses — `frameOrigins` in `providers.json` (`vidsrc.sh` for VidSrc, `vixsrc.to` for
  VixSrc, none for VidZee, taken from the runs). `js/frame-guard.js` refuses any nested frame whose
  host is not same-origin or in `frameOrigins` by pointing it at `about:blank`, and logs each refusal.
  It is installed in the player frame on load and injected into every frame the player creates
  (`js/embed.js` `startNestedFrameGuard`), and the page-level install covers the page itself.
- **JavaScript dialogs.** VidZee's `fanfirm()` prompt box. The frame guard turns `alert`, `confirm` and
  `prompt` into no-ops in the page and every frame it reaches, so a dialog can never block the page.
- **Click traps.** The first press often lands on an invisible ad layer. Two things are tested: the
  sandboxed frame (check 8), which makes the ad script's `window.open` fail inside the frame (some
  players refuse to run sandboxed); and Ghostery's cosmetic filtering, which hides ad overlays (loaded,
  but not yet checked that it reaches inside these frames). VidSrc's movie still needs a manual try in
  the open window to tell whether it is the scripted presses or the player (item 6).

## 3. Test titles

| Kind | Title | TMDB | IMDb |
|---|---|---|---|
| Movie | The Matrix (1999) | 603 | tt0133093 |
| Episode | Game of Thrones, season 1 episode 1 | 1399 | tt0944947 |
| Not available | a TMDB id the provider's availability route answers `404` for | per provider | |

## 4. The checks

Each provider is run through every check, in Chrome and in Electron, sandboxed and not. Each result is
recorded as observed (pass, fail, or what happened), with a screenshot of the stage.

| # | Check | Pass when |
|---|---|---|
| 1 | **Docs first** | its documentation is read and `providers.json` is written from it, with the URL; anything it documents beyond `12` is added to `12` |
| 2 | **Movie plays** | the movie's picture and sound play in the stage, and it is the right film |
| 3 | **Exact episode plays** | season 1 episode 1 plays, not the series' picker or another episode |
| 4 | **Start position** | with the start parameter at 300 s, playback begins at 5:00 |
| 5 | **Messages** | the documented messages arrive from the documented origin; their position and duration match the picture; their rate is recorded |
| 6 | **End and pause** | pausing and reaching the end produce the documented messages |
| 7 | **Popups contained** | every popup or new window the page tries is blocked and logged; the app window never leaves the test page |
| 8 | **Sandboxed** | whether it still plays inside the sandboxed frame (some players refuse a sandbox) |
| 9 | **Autoplay** | whether it starts by itself or needs a press inside the player |
| 10 | **Fullscreen** | the player's own fullscreen fills the window and returns |
| 11 | **Subtitles** | the player offers subtitles, and the documented language parameter selects one, where documented |
| 12 | **Not available** | what the page shows for a title the provider lacks, and whether its availability route predicted it |
| 13 | **Clean stop** | removing the frame stops picture and sound at once, and memory returns after ten loads |
| 14 | **Ads and contained network** | the hosts its page tries to reach that were refused (section 2.3); whether it still plays with only its own and its video hosts allowed; what ads still appear |

## 5. The other 47

When all three pass checks 2, 3, 5 and 7 in Electron, the owner supplies the other providers (name and
documentation URL). Each one is added to `providers.json` from its own documentation (check 1 first) and
run through the same checks. Providers that document a stream address rather than an embed page are
marked, since they could play in the app's own `<video>` like a channel.

### 5.1 The remaining providers are generated from CinePro Core (2026-10-16)

The owner's other providers are the provider classes in CinePro Core (`15`). Rather than hand-write
each one, `build-providers.mjs` generates their `providers.json` entries from the core's
`src/providers/`, so the PoC now lists all **17** core providers (3 hand-written — VidSrc, VixSrc,
VidZee — plus 14 generated). The remaining 33 of the owner's 47 (those not in the core) are added
the same way once the owner supplies their documentation URL.

The generator classifies each provider into one of the two families in `16` section 3:

- **Embed** — the provider's embed page is loaded in the PoC's iframe (the original behaviour).
  The three hand-written providers are embed-family.
- **Stream** — the provider answers a stream endpoint. The PoC does not host a third-party player
  for these (that is `13` section 5's non-goal); instead it fetches the documented endpoint and
  reports whether it answers a playable address (an HLS/MP4/DASH manifest or file). The stage shows
  that result in place of an iframe (`js/embed.js` `checkStream`, `css/poc/stage.css`).

`data/providers.json` is the hand-written entries plus the generated block; `build-providers.mjs`
is the single source of truth for the generated block and verifies each core provider folder exists
before emitting. Running `node build-providers.mjs` re-derives the 14 generated entries from the
core, so the PoC stays in step with `15` without hand-editing JSON.

## 6. Results

The saved results are summarised into a table in this document (a row per provider, a column per check,
in Chrome and in Electron). Each provider's section of `12` gets its verified facts with the date.

### 6.1 Runs so far (2026-10-16, headless Chrome)

| Provider | Unblocked | Ad-named hosts blocked | Strict (own hosts + CDNs, fonts, TMDB images, subtitles) |
|---|---|---|---|
| VidSrc | movie and exact episode play (pressed once); `PLAYER_EVENT` from `https://vidsrc.sh` with position and duration in seconds, every ~5 s, plus undocumented `PLAYER_TITLE` and `PLAYER_UI`, and `player_info` carries title, poster and quality | plays both; about 40 tracking and ad hosts still contacted (intentiq, lijit, crwdcntrl, liadm, eyeota, tapad, sharethis, histats, dtscout, and popunder-style domains such as `stellarconductornexus.com`, `zealotsofzenith.site`, `uvzvirtpncyai.space`); only `adexchangerapid.com`, `match.adsrvr.org`, `px.ads.linkedin.com` blocked | **does not play**: the player stays on its spinner and never requests a playlist or video; refused were `stellarconductornexus.com`, `s10.histats.com`, `static.cloudflareinsights.com` and two random-named hosts (`y4.zfoo2relcykev7olu9okic9kq34pbye.cfd`, `cxk.qjbjxlv6bk388zpm427m5gow2.rest`, the second does not exist) |
| VixSrc | movie and exact episode play (pressed once); messages arrive from `https://vixsrc.to` but **not in its documented shape**: the fields sit under `event` (`{"type":"PLAYER_EVENT","event":{"event":"timeupdate","currentTime":1,"duration":8175.7,"video_id":"214325"}}`) | not run | not run |
| VidZee | movie and exact episode **autoplay**; `PLAYER_EVENT` as documented (`play`, `timeupdate`, `pause` with seconds, TMDB id, season, episode) and `MEDIA_DATA` carrying the provider's own history across titles | not run | not run |

Malwarebytes flagged the unblocked runs' ad traffic and stopped the server; that is what led to section 2.3.

### 6.2 Checks still to run (2026-10-16)

The three providers have been run only for the containment and message checks (table 6.1). Seven checks
remain to be run, in Chrome and in Electron, sandboxed and not, for each of the three:

| Check | Why it is still open |
|---|---|
| 4 Start position | not yet run with `startAt` at 300 s |
| 6 End and pause | the documented end/pause messages not yet observed |
| 8 Sandboxed | not yet run in Electron; some players refuse a sandbox |
| 10 Fullscreen | the player's own fullscreen not yet exercised |
| 11 Subtitles | the documented language parameter not yet selected |
| 12 Not available | a title the provider lacks not yet run against its availability route |
| 13 Clean stop | removing the frame and the memory return after ten loads not yet measured |

The containment fixes in section 2.4 (nested frames, dialogs, fail-closed blocker, browser-case
marking) are built and need a re-run to confirm they hold; the click-trap question (item 6) needs a
manual try of the VidSrc movie in the open window. The other 47 providers (section 5.1) are listed and
playable in the PoC but have not been run through checks 2, 3, 5 and 7 yet.

### 6.2 In the Electron shell with Ghostery (2026-10-16)

The fileserver (`src/fileserver`) serves the PoC; its Electron shell (`src/fileserver/src/app`) runs
Ghostery's ads-and-tracking lists (120,321 network filters, as Giga Terminal does) plus the `ad*`/`ads`
name backstop, refuses popups and main-frame navigations, and keeps the player frame on its first origin.
No ads were seen and Malwarebytes raised nothing (owner).

| Provider | Movie | Exact episode | Blocked by Ghostery | Guards |
|---|---|---|---|---|
| VidSrc | **did not start** after three presses (poster and play button shown) | played 0 → 40.5 s after two presses | `histats`, `cloudflareinsights`, `secutorlunts.cfd`, `adexchangerapid.com`, `ntwkbc21/42.com`, `usrpubtrk.com` | popup `pr.dreggycollars.cyou` refused; before the player-frame rule, its ads navigated the player to `stellarconductornexus.com` → … → `green-planet.live` and redirected the window to `opera.com` |
| VixSrc | **autoplayed**, 1 → 46 s | **autoplayed**, 1 → 46 s | `analytics.vixcloud.co`, `vixcloud.co` images, `my.rtmark.net`, `bef77.com`, `cloudflareinsights` | none needed |
| VidZee | **autoplayed**, 0 → 42.8 s | **autoplayed**, 0 → 44.6 s | `umommy.cyou`, `rd.cokedpariti.com`, `secutorlunts.cfd`, `cloudflareinsights` | player navigation to `bs.stoitercoppin.cfd` refused; a JavaScript `confirm()` ("Upgrade Your Browser, Get Opera") still appears over the player |

The first press on VidSrc's player lands on an ad layer; with the ad refused it does nothing, and the
next press plays. Still open: VidSrc's movie, and suppressing JavaScript dialogs from player frames.

## 7. What the results decide

Once the three pass, these are written into the docs, from what was observed:

- **`03`:** what a title and an episode carry for playback (the provider, the embed address, its origin,
  in order of preference), replacing the stream-address rule of section 7.5 for titles; how the backend
  learns which provider has which title.
- **`06` section 5:** the Player stage hosting a provider's player for titles (local files keep the app's
  own `<video>`); which toolbar controls remain; resume through the start parameter; progress from the
  provider's messages; fallback to the next provider when one fails.
- **`01` and `02`:** the frame rules: which sandbox, which origins may post messages, how popups and
  navigation are refused in the browser and in Electron.
- **`13`:** the stages from the PoC to the product, per provider.

## 8. Not in the PoC

Reaching into a provider's player for its stream, intercepting its requests, or getting around its
scripts (`13` section 5). Only the embed page as the provider offers it, and the messages it documents.
