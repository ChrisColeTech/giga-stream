import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { DELETE_RUNNING } from "@/constants/job-copy";
import { JOB_GRID, JOB_HEADINGS } from "@/constants/job-grid";
import { useJobActions } from "@/hooks/useJobActions";
import { jobRow } from "@/lib/job-rows";
import { useAppStore } from "@/store/app-store";
import { JobRow } from "./JobRow";

/** The jobs grid: the header with its select-all tick, and a row for each job. Shimmer rows in the header's own
 *  columns draw while nothing has been read and when there is nothing to list; a refresh and a failed read keep the
 *  rows they have. A running job's Delete is disabled with its reason. */
export function JobRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.jobs);
  const tick = useAppStore((state) => state.jobTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useJobActions();
  const waiting = items.length === 0 || status === "idle";
  const reasonFor = (id: number, running: boolean): string | undefined => {
    if (running) return DELETE_RUNNING;
    if (unreachable) return UNREACHABLE_REASON;
    return saving || isBusy(`delete:${id}`) ? SAVING_REASON : undefined;
  };

  return (
    <RecordGrid
      ariaLabel="Jobs"
      layout={JOB_GRID}
      headings={JOB_HEADINGS}
      ticks
    >
      {waiting ? (
        <SkeletonGrid />
      ) : (
        items.map((job) => (
          <JobRow
            key={job.id}
            row={jobRow(job)}
            ticked={ticked.includes(job.id)}
            deleteReason={reasonFor(job.id, job.running)}
            onTick={tick}
            onOpen={(id) => openWorkspace("jobs", String(id))}
            onDelete={(id) => void track(`delete:${id}`, () => flows.remove(id))}
          />
        ))
      )}
    </RecordGrid>
  );
}
