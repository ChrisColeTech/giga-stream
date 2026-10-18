import { useMemo } from "react";
import { jobRow, type JobRowView } from "@/lib/job-rows";
import { jobSpec } from "@/lib/list-specs";
import { useAppStore } from "@/store/app-store";
import { useListQuery, type ListQueryView } from "./useListQuery";

const idOf = (row: JobRowView): string => String(row.id);

function retain(keep: (id: string) => boolean): void {
  const state = useAppStore.getState();
  state.jobsSetTicked(state.jobs.ticked.filter((id) => keep(String(id))));
}

/** The Jobs list as the query shows it: every job's row, filtered and sorted (`lib/list-query.ts`). */
export function useJobView(): ListQueryView<JobRowView> {
  const items = useAppStore((state) => state.jobs.items);
  const rows = useMemo(() => items.map(jobRow), [items]);
  return useListQuery({ list: "jobs", rows, spec: jobSpec, idOf, retain });
}
