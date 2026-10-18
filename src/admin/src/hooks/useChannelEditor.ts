import { useEffect } from "react";
import { checkChannel, writeReason } from "@/lib/channel-check";
import { draftOf, sameDraft, type ChannelDraft } from "@/lib/channel-draft";
import { previewWorkspaceReason } from "@/lib/channel-guard";
import { changeReason, type SaveVerb, type ToolbarAction } from "@/lib/workspace-verbs";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { useChannelActions, type ChannelActions } from "./useChannelActions";
import { usePreviewOpen } from "./usePreviewOpen";
import { useRecordForm, type RecordForm } from "./useRecordForm";

export interface ChannelEditor {
  readonly form: RecordForm<ChannelDraft>;
  readonly actions: ChannelActions;
  readonly unreachable: boolean;
  /** The form's one commit, `Save details`, ending the last editable group. */
  readonly save: SaveVerb;
  /** The toolbar's forward arrow, `Preview`. */
  readonly forward: ToolbarAction;
}

/** One channel's workspace form (`36` sections 6 and 7), live or stream: the draft against the saved channel, ONE `Save
 *  details` that sends only the changed fields, and the toolbar's `Preview` arrow for the saved channel (`Save the channel
 *  first` while the draft differs). Save is disabled with `Nothing has changed.`, the first empty required row, `Saving.` or the unreachable
 *  sentence; a value or backend refusal goes under its row. The answer becomes the new baseline. */
export function useChannelEditor(channel: AdminChannel): ChannelEditor {
  const form = useRecordForm<ChannelDraft>({ initial: draftOf(channel), same: sameDraft });
  const actions = useChannelActions();
  const unreachable = useAppStore((state) => state.channels.unreachable);
  const openPreview = usePreviewOpen();

  /* The held record changed under the workspace (a refresh, a write's answer): a clean form follows it; a form being
     edited keeps what the person typed, unless it already holds the saved values. */
  useEffect(() => {
    const next = draftOf(channel);
    if (!form.dirty || sameDraft(form.draft, next)) form.reset(next);
  }, [channel]);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await actions.track("save", () => actions.flows.save(channel.id, form.draft));
    if (result.ok) {
      if (result.value !== null) form.reset(draftOf(result.value));
    } else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  const saveVerb: SaveVerb = {
    onPress: () => void save(),
    reason: changeReason(form.dirty, checkChannel(form.draft).reason ?? writeReason({ saving: actions.saving, unreachable })),
  };
  const forward: ToolbarAction = {
    label: "Preview",
    onPress: () => openPreview(channel.id),
    reason: previewWorkspaceReason(form.dirty),
  };
  return { form, actions, unreachable, save: saveVerb, forward };
}
