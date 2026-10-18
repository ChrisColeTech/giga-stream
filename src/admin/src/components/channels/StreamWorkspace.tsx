import type { CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { CHANNEL_LABELS, STREAM_SECTION_IDS, STREAM_SECTIONS } from "@/constants/channel-copy";
import { useChannelEditor } from "@/hooks/useChannelEditor";
import { revertReason } from "@/lib/channel-guard";
import { useAppStore } from "@/store/app-store";
import type { StreamAdminChannel } from "@/types/admin-channel";
import { StreamAddressGroup } from "./StreamAddressGroup";
import { StreamDetailsGroup } from "./StreamDetailsGroup";
import { StreamStatusGroup } from "./StreamStatusGroup";

/** A stream channel's workspace (`36` section 7): the rail (`‹ Channels`, Details, Stream, Status), the strip (`Discard
 *  changes`, `Save`, `Preview →`) and one page. A hand-made row and a synced row are both editable (the sync keeps an
 *  admin's edits); `Revert to playlist` drops a synced row's edits. */
export function StreamWorkspace({ channel, active }: { readonly channel: StreamAdminChannel; readonly active: boolean }) {
  const { form, actions, unreachable, toolbar } = useChannelEditor(channel);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const spy = useScrollSpy(STREAM_SECTION_IDS, STREAM_SECTION_IDS[0] ?? "st-details");
  const draft = form.draft;
  if (draft.kind !== "stream") return null;

  return (
    <WorkspaceFrame
      tab="channels"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Channel sections"
          back={{ label: "Channels", onPress: () => closeWorkspace("channels") }}
          sections={STREAM_SECTIONS}
          spy={spy}
        />
      }
      toolbar={<WorkspaceToolbar label="Channel toolbar" {...toolbar} />}
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div className="flex flex-col px-6 pb-8" style={{ "--label-col": labelColumn(CHANNEL_LABELS) } as CSSProperties}>
          <div ref={spy.bind("st-details")}>
            <StreamDetailsGroup
              channel={channel}
              draft={draft}
              errors={form.errors}
              onChange={form.set}
              revertReason={revertReason(channel, { saving: actions.saving, unreachable })}
              onRevert={() => void actions.track("revert", () => actions.flows.revert(channel.id))}
            />
          </div>
          <div ref={spy.bind("st-stream")}>
            <StreamAddressGroup draft={draft} errors={form.errors} edited={channel.editedFields ?? []} onChange={form.set} />
          </div>
          <div ref={spy.bind("st-status")}>
            <StreamStatusGroup channel={channel} />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
