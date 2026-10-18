import { useEffect } from "react";
import { CHANNEL_GONE } from "@/constants/channel-copy";
import { useChannelFlows } from "@/hooks/useChannelFlows";
import { useAppStore } from "@/store/app-store";
import { LiveWorkspace } from "./LiveWorkspace";

/** One channel's workspace, opened from the list already held (`36` sections 6 and 7): a live channel's or a stream
 *  channel's. If the channel is no longer in a read list, the workspace closes with a notice and the list is read again. */
export function ChannelWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const channel = useAppStore((state) => state.channels.items.find((item) => item.id === id));
  const status = useAppStore((state) => state.channels.status);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const say = useAppStore((state) => state.say);
  const flows = useChannelFlows();
  const gone = channel === undefined && status === "ready";

  useEffect(() => {
    if (!gone) return;
    closeWorkspace("channels");
    say(CHANNEL_GONE, "warn", "Channel");
    void flows.refresh();
  }, [gone, closeWorkspace, say, flows]);

  if (channel === undefined) return null;
  return channel.kind === "live" ? <LiveWorkspace key={channel.id} channel={channel} active={active} /> : null;
}
