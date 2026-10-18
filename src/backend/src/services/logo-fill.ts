import type { Store } from "../store/store.js";
import type { SyncRun } from "../types/sync-run.js";
import type { LogoResolver } from "./logo-resolver.js";

/**
 * Step 3: this playlist's rows with no logo address (and no admin-edited one) are looked up in the iptv-org index,
 * by tvg id then by name, and the address is set on every such row with that playlist name. The index loads once
 * (nothing is loaded when no row needs a logo). The addresses a public reader sees changed, so a fill takes one
 * revision; a run that fills nothing takes none.
 */
export function createLogoFill(deps: { store: Store; resolver: LogoResolver }) {
  const { store, resolver } = deps;
  return async function fillLogos(run: SyncRun): Promise<number> {
    const names = store.health.namesWithoutLogo(run.playlistId);
    if (names.length === 0 || run.signal.aborted) return 0;
    await resolver.load(run.signal);
    if (run.signal.aborted) return 0;
    const found = new Map<string, string>();
    for (const { syncName, tvgId } of names) {
      const url = resolver.lookup(syncName, tvgId);
      if (url !== undefined) found.set(syncName, url);
    }
    if (found.size === 0) return 0;
    return store.health.fillLogoUrls(run.playlistId, found, () => void store.revisions.next());
  };
}

export type LogoFill = ReturnType<typeof createLogoFill>;
