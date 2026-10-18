import { Activity, Copy, Hammer, RefreshCw } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
import { cn } from "@giga/ui/lib/cn";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { StateWord } from "@/components/records/StateWord";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import { isBuilding } from "@/lib/channel-list";
import { channelState } from "@/lib/row-state";
import type { LiveAdminChannel } from "@/types/admin-channel";
import { PlaylistRows } from "./PlaylistRows";

const FACT = "flex h-9 min-w-0 items-center font-mono text-sm text-muted";

export interface LiveStatusGroupProps {
  readonly channel: LiveAdminChannel;
  /** The State row's `Refresh status` reason (`Loading.`), or undefined. */
  readonly refreshReason: string | undefined;
  readonly onRefresh: () => void;
  /** `Rebuild`'s reason (`Save the channel first`, `Enable the channel to rebuild it.`), or undefined. */
  readonly rebuildReason: string | undefined;
  readonly onRebuild: () => void;
  readonly onCopy: (address: string) => void;
}

/** A live channel's `Status` (`36` section 6), read-only. The State row ends with a `Refresh status` icon that reads the
 *  channels again (the only way a build is seen to finish: nothing polls); the group ends with the ghost `Rebuild`. While
 *  the channel is `preparing`, `starting` or `restarting` its facts are shimmer lines in their rows; otherwise the state
 *  word, a failed channel's problem, the renditions, the playlist with the video on air lit, and the stream address with
 *  a copy button. */
export function LiveStatusGroup(props: LiveStatusGroupProps) {
  const { channel, refreshReason, onRefresh, rebuildReason, onRebuild, onCopy } = props;
  const building = isBuilding(channel);
  const shimmer = (width: string) => <span className={SHIMMER} style={{ width }} aria-hidden />;

  return (
    <Group id="lv-status" icon={Activity} title="Status" last>
      <Row
        label="State"
        tip={CHANNEL_TIPS.state}
        trailing={
          <IconButton aria-label="Refresh status" title="Refresh status" reason={refreshReason} onClick={onRefresh}>
            <RefreshCw className="size-3.5" aria-hidden />
          </IconButton>
        }
      >
        <span className={FACT}>{building ? shimmer("30%") : <StateWord state={channelState(channel)} />}</span>
      </Row>
      {!building && channel.state === "failed" && channel.problem !== undefined && (
        <Row label="Problem" tip={CHANNEL_TIPS.problem}>
          <span className={cn(FACT, "text-st-failed")} title={channel.problem}>
            <span className="truncate">{channel.problem}</span>
          </span>
        </Row>
      )}
      <Row label="Renditions" tip={CHANNEL_TIPS.renditions}>
        <span className={FACT}>{building || channel.renditions.length === 0 ? shimmer("40%") : channel.renditions.join(" · ")}</span>
      </Row>
      <Row label="Playlist" tip={CHANNEL_TIPS.playlist} align="start">
        <PlaylistRows playlist={building ? [] : channel.playlist} playing={channel.nowPlaying?.index ?? null} />
      </Row>
      <Row
        label="Stream address"
        tip={CHANNEL_TIPS.liveAddress}
        trailing={
          <IconButton aria-label="Copy the address" title="Copy the address" onClick={() => onCopy(channel.streamUrl)}>
            <Copy className="size-3.5" aria-hidden />
          </IconButton>
        }
      >
        <Input value={channel.streamUrl} readOnly className={cn(FIELD_CONTROL, "font-mono text-muted")} aria-label="Stream address" />
      </Row>
      <Actions>
        <Button variant="ghost" reason={rebuildReason} onClick={onRebuild}>
          <Hammer aria-hidden /> Rebuild
        </Button>
      </Actions>
    </Group>
  );
}
