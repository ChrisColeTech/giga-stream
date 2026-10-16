# 13 - Go-Live Plan

**Status: plan; the providers' playback is proved first by `14`.** How Giga Stream moves from the
test channels and test-server titles to real channels and titles that play from real providers. Every
stage needs the owner's approval before it begins. The providers are in `12` (verified live
2026-10-16); TMDB metadata is `11`.

**Decided (owner, 2026-10-16):** titles play through the providers' embedded players, starting with
VidSrc, VixSrc and VidZee and then the owner's other 47 (`12` section 7). `14` proves it against the real
services before the product is changed.

## 1. What changes and what does not

The admin backend changes, and, from the `14` results, the Player stage and `03`'s title playback
fields. The fileserver passes through what the backend answers and probes channel addresses; channels
and local files play in the app's own `<video>`; a title plays in its provider's embedded player. There is
no resolve step, relay or proxy of video (`00` section 5).

What changes inside the backend is one configuration, chosen at deployment and never by the interface:

| Setting | Development and tests | Live |
|---|---|---|
| Provider calls | none; tests use a local HTTP server with hand-written answers | real HTTPS calls |
| Providers on | none | the approved provider ids, added one at a time |
| Title playback | the rule points at the test server (`03` section 7.5) | the providers' embed addresses, in order (`14` section 7) |
| Channels | the seeded test-server channels (`03` section 7.7, `10`) | channels an operator publishes |

Each stage flips one row. Going back is flipping it back; the owner's local data is unaffected because
the fileserver keeps no copy of the catalog.

## 2. Before starting

- `14` has passed for the providers being turned on, and its results are written into `03` and `06`.
- Phases 0-11 of `08` are done: the browser and Electron walkthroughs of `05` pass with the test channels
  and the test-server address rule.
- The owner approves starting.

## 3. G1 - The HTTP client

A provider HTTP client in the admin backend, tested against a local server only:

- HTTPS only; connect, read and total timeouts; a redirect limit; a response size cap;
- no cookies or other ambient credentials;
- logs never contain a full signed or tokenised address;
- every call can be abandoned.

**Accepted when** each request the backend will make produces the expected method, path and query,
and each hand-written answer decodes to the expected result, including not found, malformed, timeout
and unreachable.

## 4. G2 - Re-verify one provider

A first read-only check of all three was made on 2026-10-16 (`12`, with its findings in section 7). G2
repeats it, for one provider at a time and starting with VidSrc, when this work begins:

1. Read its current documentation and domains.
2. Make the calls `12` records, a few each: a movie, a series, an exact episode, a latest page, an id
   list.
3. Save the raw answers, dated, in a gitignored folder. Commit only hand-written fixtures in the same
   shape.
4. Correct `12` where the service differs, and the decoders with it.

**Accepted when** `12`'s section for that provider is marked verified with the date, and its decoders
read every saved answer.

## 5. G3 - How it plays (decided; proved by `14`)

Decided: through the provider's embedded player. Each provider passes `14`'s checks before it is turned
on; a provider that documents a real stream address instead plays in the app's own `<video>`.

No stream extraction, request interception, access-control or DRM bypass, and no proxying are added to
make something play.

**Accepted when** the provider's `14` row passes checks 2, 3, 5 and 7 in Electron.

## 6. G4 - Which titles each provider has

Library lists every TMDB title, but a provider does not have every title (`14` check 12). Find out how each approved provider says what it has (VidSrc's id lists or latest
pages, VixSrc's lists, as re-verified in G2), and what a title it lacks should show: Play disabled with
its reason, or the failed stage. That choice is the owner's, and `03` and `06` are changed to match.

**Accepted when** the owner has chosen, and a title the provider lacks behaves as chosen.

## 7. G5 - One provider plays

Turn on the first provider's embedded player for titles, as `14` section 7 wrote it into `03` and `06`:

- a movie and an exact episode play in the browser and in Electron;
- progress, pause, the end of a title, switching and closing tabs record watch history as `06`
  section 5 says;
- Retry loads the address again cleanly.

**Accepted when** the `05` movie and series walkthroughs pass with that provider.

## 8. G6 - More providers

Add each further provider separately, after it has passed G2 and G3. Which provider a title plays from,
in what order, and what happens when one fails are the backend's business; the interface has no source
or provider control (`06` section 10).

**Accepted when** a title available from two providers still plays with the first one stopped, in the
browser and in Electron.

## 9. G7 - Real channels

Replace the seeded channels with channels an operator publishes:

- `https` HLS addresses only; the probe (`03` section 5) marks each live or offline;
- logos through the image cache;
- hls.js first, the browser's own HLS only as a fallback (`02` section 3.1);
- quality, audio, captions and latency rows act on real streams;
- a stream that only plays through a relay is not used.

**Accepted when** the `05` Live walkthrough passes on real channels. This stage does not depend on G4
to G6.

## 10. G8 - Release

Before the live configuration becomes the packaged default:

- the gate passes; the browser and Electron walkthroughs pass;
- provider and channel failures leave the shell responsive;
- logs carry no secrets and no private paths;
- the development configuration (seeded channels, `ALLOW_LOOPBACK_STREAMS`) still works, and switching
  back to it has been shown;
- the owner signs off the packaged build.
