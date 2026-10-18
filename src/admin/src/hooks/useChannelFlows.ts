import { useMemo } from "react";
import { channels } from "@/services/channels";
import { createChannelFlows, type ChannelFlows } from "@/services/channel-flows";
import { useAppStore } from "@/store/app-store";

/** The Channels tab's flows (`services/channel-flows.ts`) wired to the real service and the one store. */
export function useChannelFlows(): ChannelFlows {
  return useMemo(() => createChannelFlows({ service: channels, store: () => useAppStore.getState() }), []);
}
