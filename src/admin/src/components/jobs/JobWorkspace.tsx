import type { CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { JOB_GONE, JOB_SECTIONS, JOB_SECTION_KEYS, JOB_WORKSPACE_LABELS } from "@/constants/job-copy";
import { useFollowRecord } from "@/hooks/useFollowRecord";
import { useJobActions } from "@/hooks/useJobActions";
import { useWorkspaceGone } from "@/hooks/useWorkspaceGone";
import { useRecordForm } from "@/hooks/useRecordForm";
import { draftOf, sameJobDraft, type RunToggles } from "@/lib/job-draft";
import { workspaceRunReason } from "@/lib/job-run-gate";
import { idOf } from "@/lib/playlist-rows";
import { changeReason, type ToolbarAction } from "@/lib/workspace-verbs";
import type { JobResult } from "@/services/job-flows";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { JobDetailsGroup } from "./JobDetailsGroup";
import { JobLastRunGroup } from "./JobLastRunGroup";
import { JobRunGroup } from "./JobRunGroup";
import { JobScheduleGroup } from "./JobScheduleGroup";

const LABEL_COLUMN = { "--label-col": labelColumn(JOB_WORKSPACE_LABELS) } as CSSProperties;

function Editor({ job, active }: { readonly job: AdminJob; readonly active: boolean }) {
  const form = useRecordForm({ initial: draftOf(job), same: sameJobDraft });
  const { flows, saving, isBusy, track } = useJobActions();
  const unreachable = useAppStore((state) => state.jobs.unreachable);
  const playlists = useAppStore((state) => state.jobs.playlists);
  const loading = useAppStore((state) => state.jobs.status === "loading");
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const requestTab = useAppStore((state) => state.requestTab);
  const spy = useScrollSpy(JOB_SECTION_KEYS, JOB_SECTION_KEYS[0] ?? "jw-details");
  const runKey = `run:${job.id}`;

  useFollowRecord(form, job, draftOf, sameJobDraft);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await track("save", () => flows.save(job.id, form.draft));
    if (result.ok) {
      if (result.value !== null) form.reset(draftOf(result.value));
    } else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };
  const run = (toggles: RunToggles): Promise<JobResult> => flows.run(job.id, toggles);
  const runReason = workspaceRunReason(job, { dirty: form.dirty, busy: isBusy(runKey), unreachable, playlists });
  const forward: ToolbarAction =
    job.type === "playlist"
      ? { label: "Channels", onPress: () => requestTab("channels") }
      : { label: "Titles", onPress: () => requestTab("titles") };

  return (
    <WorkspaceFrame
      tab="jobs"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Job sections"
          back={{ label: "Jobs", onPress: () => closeWorkspace("jobs") }}
          sections={JOB_SECTIONS}
          spy={spy}
        />
      }
      toolbar={<WorkspaceToolbar dirty={form.dirty} onDiscard={form.discard} forward={forward} />}
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div className="flex flex-col px-6 pb-8" style={LABEL_COLUMN}>
          <div ref={spy.bind("jw-details")}>
            <JobDetailsGroup
              job={job}
              draft={form.draft}
              errors={form.errors}
              playlists={playlists}
              onChange={form.set}
            />
          </div>
          <div ref={spy.bind("jw-schedule")}>
            <JobScheduleGroup
              value={form.draft.schedule}
              job={job}
              error={form.errors["schedule"]}
              onChange={(schedule) => form.set({ schedule })}
              save={{
                onPress: () => void save(),
                reason: changeReason(form.dirty, saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined),
              }}
            />
          </div>
          <div ref={spy.bind("jw-run")}>
            <JobRunGroup job={job} reason={runReason} onRun={(toggles) => track(runKey, () => run(toggles))} />
          </div>
          <div ref={spy.bind("jw-last")}>
            <JobLastRunGroup
              job={job}
              loading={loading}
              onRefresh={() => void track("refresh", flows.refresh)}
              onOpenChannel={(id) => requestTab("channels", id)}
            />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One job's workspace (`38` section 4.3), opened from the list already held: the rail (`‹ Jobs`, Details, Schedule,
 *  Run, Last run), the page toolbar (`Discard changes` left; rightmost `Channels →` for a playlist job or `Titles →` for
 *  a catalog job) and one scrolling page whose Schedule group ends with `Save details`. A job gone from a read list (its playlist deleted elsewhere) closes with a notice. */
export function JobWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const job = useAppStore((state) => state.jobs.items.find((item) => item.id === idOf(id)));
  const status = useAppStore((state) => state.jobs.status);
  useWorkspaceGone("jobs", job === undefined && status === "ready", JOB_GONE, "Job");

  return job === undefined ? null : <Editor key={job.id} job={job} active={active} />;
}
