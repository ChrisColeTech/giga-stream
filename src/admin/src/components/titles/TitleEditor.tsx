import { DiscardBar } from "@/components/records/DiscardBar";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { MANUAL_NO_TMDB, NOTHING_EDITED, SAVING_REASON, UNREACHABLE_REASON } from "@/constants/title-copy";
import { useFollowRecord } from "@/hooks/useFollowRecord";
import { useRecordForm } from "@/hooks/useRecordForm";
import { useTitleActions } from "@/hooks/useTitleActions";
import { changeReason, type ToolbarAction } from "@/lib/workspace-verbs";
import { formKeyOf, saveRequiredReason } from "@/lib/title-checks";
import { draftOfTitle, sameTitleDraft } from "@/lib/title-draft";
import { isManualTitle } from "@/lib/title-rows";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { TitleDetailsGroup } from "./TitleDetailsGroup";
import { TitleFrame } from "./TitleFrame";
import { TitleImagesGroup } from "./TitleImagesGroup";
import { TitlePlotGroup } from "./TitlePlotGroup";
import { TitleSeasonsGroup } from "./TitleSeasonsGroup";

export interface TitleEditorProps {
  readonly detail: AdminTitleDetail;
  readonly active: boolean;
  readonly jobs: ToolbarAction;
}

/** Why `Revert to TMDB` is disabled (`37` section 4.3): a title made by hand, nothing edited, a call running. */
function revertReason(detail: AdminTitleDetail, saving: boolean, unreachable: boolean): string | undefined {
  if (isManualTitle(detail)) return MANUAL_NO_TMDB;
  if ((detail.editedFields ?? []).length === 0 && detail.state !== "edited") return NOTHING_EDITED;
  return saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined;
}

/** A title's workspace once its detail has answered: the form over the detail, ONE Save sending only the changed fields
 *  (`lib/title-body.ts`; an emptied optional field is `null`), whose answer replaces the row and the baseline. `Save
 *  details` ends the page's last group; `Revert to TMDB` is the icon on Details' State row. */
export function TitleEditor({ detail, active, jobs }: TitleEditorProps) {
  const form = useRecordForm({ initial: draftOfTitle(detail), same: sameTitleDraft });
  const { flows, saving, track } = useTitleActions();
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const manual = isManualTitle(detail);
  const series = detail.kind === "tv";

  useFollowRecord(form, detail, draftOfTitle, sameTitleDraft);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await track("save", () => flows.save(detail.id, form.draft));
    if (result.ok) {
      if (result.value !== null) form.reset(draftOfTitle(result.value));
    } else if (result.dropped !== true && result.field !== undefined) {
      form.setError(formKeyOf(result.field), result.sentence);
    }
  };
  const revert = async (): Promise<void> => {
    const result = await track("revert", () => flows.revert(detail.id));
    const next = useAppStore.getState().titles.detail?.value;
    if (result.ok && next !== null && next !== undefined) form.reset(draftOfTitle(next));
  };
  const reason = saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : saveRequiredReason(form.draft);
  const saveVerb = { onPress: () => void save(), reason: changeReason(form.dirty, reason) };

  return (
    <TitleFrame
      series={series}
      active={active}
      toolbar={<WorkspaceToolbar label="Title toolbar" forward={jobs} />}
      bar={<DiscardBar dirty={form.dirty} onDiscard={form.discard} />}
    >
      {(spy) => (
        <>
          <div ref={spy.bind("tw-details")}>
            <TitleDetailsGroup
              detail={detail}
              draft={form.draft}
              errors={form.errors}
              onChange={form.set}
              revert={{ reason: revertReason(detail, saving, unreachable), onPress: () => void revert() }}
            />
          </div>
          <div ref={spy.bind("tw-plot")}>
            <TitlePlotGroup draft={form.draft} errors={form.errors} onChange={form.set} />
          </div>
          <div ref={spy.bind("tw-images")}>
            <TitleImagesGroup
              draft={form.draft}
              errors={form.errors}
              onChange={form.set}
              save={series ? undefined : saveVerb}
            />
          </div>
          {series && (
            <div ref={spy.bind("tw-seasons")}>
              <TitleSeasonsGroup
                detail={detail}
                manual={manual}
                seasons={form.draft.seasons}
                onChange={(seasons) => form.set({ seasons })}
                save={saveVerb}
              />
            </div>
          )}
        </>
      )}
    </TitleFrame>
  );
}
