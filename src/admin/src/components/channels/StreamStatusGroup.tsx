import { Activity, Image as ImageIcon, Undo2 } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { StateWord } from "@/components/records/StateWord";
import { CHANNEL_TIPS } from "@/constants/channel-tips";
import { formatWhen } from "@/lib/format-when";
import { streamStatusState } from "@/lib/row-state";
import type { StreamAdminChannel } from "@/types/admin-channel";

const FACT = "flex h-9 min-w-0 items-center truncate font-mono text-sm text-muted";

export interface StreamStatusGroupProps {
  readonly channel: StreamAdminChannel;
  /** `Revert to playlist`'s reason (a hand-made row, nothing edited), or undefined. */
  readonly revertReason: string | undefined;
  readonly onRevert: () => void;
}

/** A stream channel's `Status` (`36` section 7), read-only: its id, where it came from (`Synced from <playlist>` for a row
 *  a playlist made, `Added by hand` otherwise, ending with the `Revert to playlist` icon that drops the admin's edits of
 *  a synced row), whether players read it (`Published`: enabled, and its playlist enabled) and its revision. */
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
        <span className={FACT}>
          {channel.playlistId === undefined ? "Added by hand" : `Synced from ${channel.playlistName ?? channel.source ?? ""}`}
        </span>
      </Row>
      <Row label="Stream" tip={CHANNEL_TIPS.stream}>
        <span className="flex h-9 items-center">
          <StateWord state={streamStatusState(channel.status)} />
        </span>
      </Row>
      <Row label="Checked" tip={CHANNEL_TIPS.checked}>
        <span className={FACT}>{formatWhen(channel.checkedAt)}</span>
      </Row>
      <Row label="Logo" tip={CHANNEL_TIPS.logoCached} align="start">
        <span
          data-logo={channel.cachedLogoUrl === undefined ? "none" : "cached"}
          className="my-1 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hair bg-panel text-faint"
        >
          {channel.cachedLogoUrl === undefined ? (
            <ImageIcon className="size-5" aria-hidden />
          ) : (
            <img src={channel.cachedLogoUrl} alt="" className="size-full object-contain" />
          )}
        </span>
      </Row>
      <Row label="Published" tip={CHANNEL_TIPS.published}>
        <span className={FACT}>{channel.published ? "yes" : "no"}</span>
      </Row>
      <Row label="Revision" tip={CHANNEL_TIPS.revision}>
        <span className={FACT}>{channel.revision}</span>
      </Row>
    </Group>
  );
}
