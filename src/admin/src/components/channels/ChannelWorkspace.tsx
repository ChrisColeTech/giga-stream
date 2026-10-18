import { CHANNEL_GONE } from "@/constants/channel-copy";
import { useChannelFlows } from "@/hooks/useChannelFlows";
import { useWorkspaceGone } from "@/hooks/useWorkspaceGone";
import { channelById } from "@/lib/channel-list";
import { useAppStore } from "@/store/app-store";
import { LiveWorkspace } from "./LiveWorkspace";
import { StreamWorkspace } from "./StreamWorkspace";

/** One channel's workspace, opened from the list already held (`36` sections 6 and 7): a live channel's or a stream
 *  channel's. If the channel is no longer in a read list, the workspace closes with a notice and the list is read again. */
export function ChannelWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const channel = useAppStore((state) => channelById(state.channels, id));
  const status = useAppStore((state) => state.channels.status);
  const flows = useChannelFlows();
  useWorkspaceGone("channels", channel === undefined && status === "ready", CHANNEL_GONE, "Channel", flows.refresh);

  if (channel === undefined) return null;
  return channel.kind === "live" ? (
    <LiveWorkspace key={channel.id} channel={channel} active={active} />
  ) : (
    <StreamWorkspace key={channel.id} channel={channel} active={active} />
  );
}
