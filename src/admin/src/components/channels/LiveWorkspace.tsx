import type { CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { CHANNEL_LABELS, CHOOSE_UNAVAILABLE, LIVE_SECTION_IDS, LIVE_SECTIONS, LOADING_REASON } from "@/constants/channel-copy";
import { useChannelEditor } from "@/hooks/useChannelEditor";
import { rebuildReason } from "@/lib/channel-guard";
import { useAppStore } from "@/store/app-store";
import type { LiveAdminChannel } from "@/types/admin-channel";
import { LiveDetailsGroup } from "./LiveDetailsGroup";
import { LiveStatusGroup } from "./LiveStatusGroup";
import { PlaybackGroup } from "./PlaybackGroup";

/** A live channel's workspace (`36` section 6): the rail (`‹ Channels`, Details, Playback, Status), the strip
 *  (`Discard changes`, `Save`, `Preview →`) and one scrolling page. `Rebuild` and the Status `Refresh` are
 *  their own verbs; everything else is the one Save. */
export function LiveWorkspace({ channel, active }: { readonly channel: LiveAdminChannel; readonly active: boolean }) {
  const { form, actions, unreachable, toolbar } = useChannelEditor(channel);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const loading = useAppStore((state) => state.channels.status === "loading");
  const spy = useScrollSpy(LIVE_SECTION_IDS, LIVE_SECTION_IDS[0] ?? "lv-details");
  const { flows, saving, track } = actions;
  const write = { saving, unreachable };
  const draft = form.draft;
  if (draft.kind !== "live") return null;

  const choose = async (): Promise<void> => {
    const folder = await actions.chooseFolder();
    if (folder !== null) form.set({ folder });
  };

  return (
    <WorkspaceFrame
      tab="channels"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Channel sections"
          back={{ label: "Channels", onPress: () => closeWorkspace("channels") }}
          sections={LIVE_SECTIONS}
          spy={spy}
        />
      }
      toolbar={<WorkspaceToolbar label="Channel toolbar" {...toolbar} />}
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div className="flex flex-col px-6 pb-8" style={{ "--label-col": labelColumn(CHANNEL_LABELS) } as CSSProperties}>
          <div ref={spy.bind("lv-details")}>
            <LiveDetailsGroup
              channel={channel}
              draft={draft}
              errors={form.errors}
              onChange={form.set}
              rebuildReason={rebuildReason(channel, form.dirty, write)}
              onRebuild={() => void track("rebuild", () => flows.rebuild(channel.id))}
              chooseReason={actions.canChoose ? undefined : CHOOSE_UNAVAILABLE}
              onChoose={() => void choose()}
            />
          </div>
          <div ref={spy.bind("lv-playback")}>
            <PlaybackGroup draft={draft} onChange={form.set} />
          </div>
          <div ref={spy.bind("lv-status")}>
            <LiveStatusGroup
              channel={channel}
              refreshReason={loading ? LOADING_REASON : undefined}
              onRefresh={() => void track("refresh", flows.refresh)}
              onCopy={actions.copyAddress}
            />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
