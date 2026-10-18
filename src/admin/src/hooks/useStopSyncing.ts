import { useMemo } from "react";
import { jobs } from "@/services/jobs";
import { createStopSyncing } from "@/services/stop-syncing";
import { useAppStore } from "@/store/app-store";
import { useAuditTail } from "./useAuditTail";

/** The statusbar's `Stop`: stops every running job (`services/stop-syncing.ts`), wired to the real jobs service, the one
 *  store and the audit tail. */
export function useStopSyncing(): () => Promise<void> {
  const audit = useAuditTail();
  return useMemo(() => createStopSyncing({ service: jobs, store: () => useAppStore.getState(), audit }), [audit]);
}
