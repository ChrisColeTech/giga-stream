import { useCallback, useMemo, useState } from "react";
import { createJobFlows, type JobFlows } from "@/services/job-flows";
import { jobs } from "@/services/jobs";
import { playlists } from "@/services/playlists";
import { useAppStore } from "@/store/app-store";
import { useAuditTail } from "./useAuditTail";

/** The Jobs page's verbs over its flows (`services/job-flows.ts`, wired to the real services, the one store and the
 *  audit tail), each marked busy for the length of its call so its control can say `Saving.` or `Running.`. Keys:
 *  `create`, `save`, `run:<id>`, `delete:<id>`, `refresh`. */
export interface JobActions {
  readonly flows: JobFlows;
  /** True while any write but a run is going. */
  readonly saving: boolean;
  readonly isBusy: (key: string) => boolean;
  readonly track: <T>(key: string, call: () => Promise<T>) => Promise<T>;
}

export function useJobActions(): JobActions {
  const audit = useAuditTail();
  const flows = useMemo(
    () => createJobFlows({ service: jobs, playlists, store: () => useAppStore.getState(), audit }),
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
  const writes = busy.filter((key) => key !== "refresh" && !key.startsWith("run:") && !key.startsWith("stop:"));
  return { flows, saving: writes.length > 0, isBusy: (key) => busy.includes(key), track };
}
