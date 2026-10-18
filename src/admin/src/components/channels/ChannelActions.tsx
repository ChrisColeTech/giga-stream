import { Eye } from "lucide-react";
import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { Button } from "@giga/ui/controls/Button";
import { DELETE_TIP } from "@/constants/channel-copy";
import { PREVIEW_TOOLTIP } from "@/constants/toolbar-icons";
import type { ChannelRowView } from "@/lib/channel-rows";

export interface ChannelActionsProps {
  readonly row: ChannelRowView;
  /** Why Delete is disabled (the backend unreachable, a call running); undefined when it works. */
  readonly deleteReason: string | undefined;
  /** Why Preview is disabled (the backend unreachable: the window reads the channel afresh); undefined when it works. */
  readonly previewReason: string | undefined;
  readonly onPreview: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

/** The end cell of a channel row, always at the table's right edge: `Preview` (the eye, the page toolbar's `Preview →`
 *  for this row, live or stream) beside the armed `Delete` naming the channel. A synced row's Delete says at rest that the
 *  next sync adds it again. The armed question grows leftwards over the neighbours. */
export function ChannelActions({ row, deleteReason, previewReason, onPreview, onDelete }: ChannelActionsProps) {
  return (
    <span className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        aria-label={PREVIEW_TOOLTIP}
        title={previewReason === undefined ? PREVIEW_TOOLTIP : undefined}
        reason={previewReason}
        onClick={() => onPreview(row.id)}
      >
        <Eye aria-hidden />
      </Button>
      <ArmedButton
        question={`Delete ${row.name}?`}
        disabled={deleteReason !== undefined}
        title={deleteReason ?? row.deleteTip ?? DELETE_TIP}
        onConfirm={() => onDelete(row.id)}
      >
        Delete
      </ArmedButton>
    </span>
  );
}
