import { useState } from "react";
import type { ChannelVerdict } from "@/services/schemas/channel-schema";
import { previewVerbs, type PreviewVerbPlan } from "@/lib/preview-verbs";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { useChannelFlows } from "./useChannelFlows";

export interface PreviewVerbs {
  readonly plan: PreviewVerbPlan;
  readonly toggleEnabled: () => void;
  /** Records the verdict the switch was flipped to (`51` section 2.6): the explicit value, never a guess. */
  readonly mark: (verdict: ChannelVerdict) => void;
}

/** The Preview toolbar's two toggles (`36` section 8.1, `51` section 2.6) over the Channels flows: the same single-row
 *  save and the verdict route. The answer replaces the row in the list and the window's copy together; one verb runs at
 *  a time. */
export function usePreviewVerbs(channel: AdminChannel | undefined, reading: boolean): PreviewVerbs {
  const flows = useChannelFlows();
  const unreachable = useAppStore((state) => state.channels.unreachable);
  const [busy, setBusy] = useState(false);
  const plan = previewVerbs(channel, { reading, unreachable, busy });

  const run = (call: (held: AdminChannel) => Promise<unknown>) => (): void => {
    if (channel === undefined || busy) return;
    setBusy(true);
    void call(channel).finally(() => setBusy(false));
  };
  return {
    plan,
    toggleEnabled: run((held) => flows.setEnabled(held.id, !held.enabled)),
    mark: (verdict) => run((held) => flows.mark(held.id, verdict)),
  };
}
