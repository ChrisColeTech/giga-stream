import { useState } from "react";
import { previewVerbs, verdictToSet, type PreviewVerbPlan } from "@/lib/preview-verbs";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { useChannelFlows } from "./useChannelFlows";

export interface PreviewVerbs {
  readonly plan: PreviewVerbPlan;
  readonly toggleEnabled: () => void;
  readonly mark: () => void;
}

/** The Preview toolbar's `Enable` / `Disable` and `Mark live` / `Mark dead` (`36` section 8.1) over the Channels flows:
 *  the same single-row save and the new verdict route. The answer replaces the row in the list and the window's copy
 *  together; one verb runs at a time. */
export function usePreviewVerbs(channel: AdminChannel | undefined, reading: boolean, playerFailed: boolean): PreviewVerbs {
  const flows = useChannelFlows();
  const unreachable = useAppStore((state) => state.channels.unreachable);
  const [busy, setBusy] = useState(false);
  const plan = previewVerbs(channel, { reading, unreachable, busy, playerFailed });

  const run = (call: (held: AdminChannel) => Promise<unknown>) => (): void => {
    if (channel === undefined || busy) return;
    setBusy(true);
    void call(channel).finally(() => setBusy(false));
  };
  return {
    plan,
    toggleEnabled: run((held) => flows.setEnabled(held.id, !held.enabled)),
    mark: run((held) => flows.mark(held.id, verdictToSet(held, playerFailed))),
  };
}
