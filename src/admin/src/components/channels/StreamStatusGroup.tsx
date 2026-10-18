import { Activity, Undo2 } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import type { StreamAdminChannel } from "@/types/admin-channel";

const FACT = "flex h-9 min-w-0 items-center truncate font-mono text-sm text-muted";

export interface StreamStatusGroupProps {
  readonly channel: StreamAdminChannel;
  /** `Revert to playlist`'s reason (a hand-made row, nothing edited), or undefined. */
  readonly revertReason: string | undefined;
  readonly onRevert: () => void;
}

/** A stream channel's `Status` (`36` section 7), read-only: its id, where it came from (`Synced from <host>` for a row a
 *  playlist sync made, `Added by hand` otherwise, ending with the `Revert to playlist` icon that drops the admin's edits
 *  of a synced row) and its revision. */
export function StreamStatusGroup({ channel, revertReason, onRevert }: StreamStatusGroupProps) {
  return (
    <Group id="st-status" icon={Activity} title="Status" last>
      <Row label="Id" tip={CHANNEL_TIPS.id}>
        <span className={FACT}>{channel.id}</span>
      </Row>
      <Row
        label="Synced from"
        tip={CHANNEL_TIPS.syncedFrom}
        trailing={
          <IconButton aria-label="Revert to playlist" title="Revert to playlist" reason={revertReason} onClick={onRevert}>
            <Undo2 className="size-3.5" aria-hidden />
          </IconButton>
        }
      >
        <span className={FACT}>{channel.source === undefined ? "Added by hand" : `Synced from ${channel.source}`}</span>
      </Row>
      <Row label="Revision" tip={CHANNEL_TIPS.revision}>
        <span className={FACT}>{channel.revision}</span>
      </Row>
    </Group>
  );
}
