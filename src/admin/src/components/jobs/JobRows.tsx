import { useMemo } from "react";
import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { DELETE_RUNNING, DELETE_TITLE, PLAYLIST_JOB_OWNED } from "@/constants/job-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { jobRow, type JobRowView } from "@/lib/job-rows";
import { useAppStore } from "@/store/app-store";
import { jobColumns } from "./job-columns";

const idOf = (row: JobRowView): string => String(row.id);

/** The jobs table: a row for each job (name, type, target, schedule, last run, outcome, the state cell with its pulsing bar
 *  while it runs) and the end `Delete`, an armed two-step (deleting a job changes nothing it created). A playlist's job and
 *  a running job have their Delete disabled with its reason (a playlist's job goes with the playlist). Skeleton rows in the
 *  same columns draw while nothing has been read and when there is nothing to list; a refresh and a failed read keep the
 *  rows they have. */
export function JobRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.jobs);
  const tick = useAppStore((state) => state.jobTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useJobActions();
  const waiting = items.length === 0 || status === "idle";
  const rows = useMemo(() => items.map(jobRow), [items]);
  const jobs = useMemo(() => new Map(items.map((job) => [job.id, job])), [items]);

  const rowView = (row: JobRowView): RecordRowView => {
    const job = jobs.get(row.id);
    const reason = deleteReason(row.id, job?.running === true, job?.type === "playlist");
    return {
      state: row.state.word,
      dimmed: row.state.dimmed,
      ticked: ticked.includes(row.id),
      tick: { label: `Select ${row.name}`, onToggle: (on) => tick(row.id, on) },
      onOpen: () => openWorkspace("jobs", String(row.id)),
      end: (
        <ArmedButton
          question={`Delete ${row.name}?`}
          disabled={reason !== undefined}
          title={reason ?? DELETE_TITLE}
          onConfirm={() => void track(`delete:${row.id}`, () => flows.remove(row.id))}
        >
          Delete
        </ArmedButton>
      ),
    };
  };
  const deleteReason = (id: number, running: boolean, owned: boolean): string | undefined => {
    if (owned) return PLAYLIST_JOB_OWNED;
    if (running) return DELETE_RUNNING;
    if (unreachable) return UNREACHABLE_REASON;
    return saving || isBusy(`delete:${id}`) ? SAVING_REASON : undefined;
  };

  return <RecordTable ariaLabel="Jobs" columns={jobColumns} rows={rows} idOf={idOf} rowView={rowView} waiting={waiting} />;
}
