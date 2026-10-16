import type { PlaylistSyncService } from "./playlist-sync-service.js";
import { formatSchedule } from "./title-shapes.js";

/**
 * The playlist-sync schedule (docs/03 section 7.2c), on the catalog-sync pattern (`title-sync.ts`):
 * armed only when playlists and an interval are both set, it runs the sync once after start-up and
 * every interval after, audited with the actor `system`. This and the catalog sync are the system's
 * only timers (docs/01 section 4.4).
 */
export function createPlaylistSchedule(deps: { sync: PlaylistSyncService; now: () => number }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let intervalMs: number | undefined;
  let chain: Promise<void> = Promise.resolve();

  return {
    /** Arm the interval: the first tick runs at once, like the catalog sync's warm-up. */
    armSchedule(ms: number): void {
      this.clearSchedule();
      intervalMs = ms;
      const tick = (): void => {
        chain = chain.then(async () => {
          if (!deps.sync.isRunning()) await deps.sync.run({}, {}).catch(() => {});
        });
        timer = setTimeout(tick, ms);
      };
      tick();
    },

    clearSchedule(): void {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      intervalMs = undefined;
    },

    describe(): string {
      return formatSchedule(intervalMs);
    },

    /** Test seam: resolves when no scheduled run is in flight. */
    async idle(): Promise<void> {
      await chain;
    },
  };
}

export type PlaylistSchedule = ReturnType<typeof createPlaylistSchedule>;
