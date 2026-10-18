import { useCallback, useMemo, useState } from "react";
import { jobs } from "@/services/jobs";
import { createPlaylistFlows, type PlaylistFlows } from "@/services/playlist-flows";
import { playlists } from "@/services/playlists";
import { useAppStore } from "@/store/app-store";
import { useAuditTail } from "./useAuditTail";

/** The Playlists page's verbs over its flows (`services/playlist-flows.ts`, wired to the real services, the one store
 *  and the audit tail), each marked busy for the length of its call so its control can say `Saving.`. Keys: `create`,
 *  `save`, `delete:<id>`, `refresh`. */
export interface PlaylistActions {
  readonly flows: PlaylistFlows;
  /** True while any write is running. */
  readonly saving: boolean;
  readonly isBusy: (key: string) => boolean;
  readonly track: <T>(key: string, call: () => Promise<T>) => Promise<T>;
}

export function usePlaylistActions(): PlaylistActions {
  const audit = useAuditTail();
  const flows = useMemo(
    () => createPlaylistFlows({ service: playlists, jobs, store: () => useAppStore.getState(), audit }),
    [audit],
  );
  const [busy, setBusy] = useState<readonly string[]>([]);
  const track = useCallback(async <T>(key: string, call: () => Promise<T>): Promise<T> => {
    setBusy((keys) => [...keys, key]);
    try {
      return await call();
    } finally {
      setBusy((keys) => keys.filter((one) => one !== key));
    }
  }, []);
  const writes = busy.filter((key) => key !== "refresh");
  return { flows, saving: writes.length > 0, isBusy: (key) => busy.includes(key), track };
}
