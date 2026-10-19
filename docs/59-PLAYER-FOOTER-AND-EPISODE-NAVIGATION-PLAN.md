# 59 - The Player footer earns its space with episode navigation (plan v1)

**Status: v1 (2026-10-19).** Owner: "can you tell me how resume and start over works on player? or is it just
placeholder? its a lot of space for just two buttons. are there more player functions we can add there? prev/next
episode? loop? ffwd or rewind? or is that too crammed?" Scope: the frontend Player inspector/footer, episode adjacency,
progress settlement and resume capability. No server route changes. Landing (`07` 6.1): one frontend worker.

## 1. Why (observed in merged code)

- Resume and Start over are real: Resume freezes the saved point when playback opens, reloads the active native source
  at that position or passes it through an embed's `startParam`; Start over writes progress zero and reloads at zero.
  Both are full-width in a two-column block pinned in every state, even idle/playing where they are disabled.
- The footer may also hold the Source control and saved-position line, but a one-source movie/local item leaves a large
  block for two buttons. Series navigation exists only through the left episode list; there is no adjacent helper.
- Resume currently checks saved progress/source/paused but not source capability. Native/local/app streams can resume;
  an embed can only resume when its provider source declares `startParam`. Without it, reloading cannot honor the saved
  timestamp.
- The held title has season summaries and one displayed season's episodes, not every season's episodes. Cross-season
  Previous/Next must read/cache the adjacent season; it cannot invent E1/E{count} from counts alone.

## 2. Decisions

1. **Keep the footer, make it compact.** Source (only with 2+ sources), episode navigation (series only), saved position
   (only real progress), then compact Resume/Start-over actions. Idle retains a thin stable footer with the two compact
   disabled actions/reasons, never the current full-width block. No toolbar on the stage.
2. **Resume capability:** stream/native sources resume; embeds resume only with `startParam`. An unsupported embed's
   Resume is disabled with `This source does not support resuming at a saved position.` Start over stays available.
   `messageShape` affects progress reporting, not seek capability.
3. **Series gets `Previous` / `Next`** compact secondary controls (accessible names Previous episode / Next episode),
   shown only with an exact playing episode. First/last reasons are `This is the first episode.` / `This is the last
   episode.`; loading/read failure/navigation-in-progress carry exact accessible reasons. Navigation remains available
   while playing.
4. **Adjacency uses real episodes.** Sort positive season summaries and returned episodes numerically; same-season uses
   the nearest lower/higher episode number; a boundary reads/caches the neighboring season, skips empty seasons and
   chooses its last/first returned episode. Never manufacture an episode from `episodeCount`. Season 0/specials are
   excluded until the positive-season episode schema supports them explicitly.
5. **One settled switch path** serves Previous, Next and clicking an episode row: advance the existing latest-wins
   navigation generation; await `progress.flush(false)`; if still latest, dispatch the exact season/episode, mark paused
   and user-initiated; the playback-key effect begins the new exact watch identity and opens it after a source resolves.
   A pending switch cannot overwrite a later switch, Close or another title. Never call restart - each episode owns its
   own progress identity.
6. **Do not add duplicate/inconsistent transport:** no rewind/fast-forward, loop, play/pause, fullscreen, volume,
   captions or speed in the footer. Native/embed controls own transport; provider frames cannot reliably accept those
   commands. No auto-next is implied.

## 3. Changes from what is merged

- `src/frontend/src/lib/episode-adjacency.ts`: pure sorted/cache adjacency; `lib/player-sources.ts` gains
  `canResumeSource`.
- Hooks split under limits: `useEpisodeAdjacency.ts` caches season responses and resolves boundaries;
  `useSettledEpisodeSwitch.ts` owns latest-wins progress settlement/dispatch.
- `components/player/EpisodeFooterNavigation.tsx` (compact Previous/Next); `ResumeFooter.tsx` becomes the compact shell;
  `PlayerInspector.tsx` composes Source -> episodes -> progress/actions; `PlayerPage.tsx` wires targets/switching without
  growing past 200 lines. Episode-row selection uses the same settled switch.
- Existing services/routes unchanged; `GET /api/titles/:id/seasons/:season` supplies boundary data.

## 4. Tests

- Adjacency: same season; nonconsecutive numbers; first/last; boundary reads; unsorted data; empty/zero-count seasons
  skipped; Season 0 excluded; read pending/failure reasons.
- Navigation: final progress settles before switch; rapid Previous then Next commits only Next; pending switch cannot
  overwrite Close/new title; failed flush warns only for the latest operation; exact watch identities/playback IDs.
- Capability: local/app stream resumable; embed with startParam resumable; embed without it disabled; messageShape alone
  does not imply Resume; Start over still works.
- Composition: compact idle/loading/movie/series first/middle/last layouts; Source -> episode nav -> saved point/actions;
  no duplicated transport controls; reasons accessible. Gate, then real native + provider + multi-season drive.

## 5. Docs (coordinator)

`06` sections 5.2-5.4 (footer diagram, capability and episode controls), `22` source/resume wiring, `30` episode switch
as an awaited progress boundary and its tests. Correct stale 30-second wording to the implemented ten-second media-time
throttle plus boundaries.
