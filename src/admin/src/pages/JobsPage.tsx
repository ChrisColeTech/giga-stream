import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { JobWorkspace } from "@/components/jobs/JobWorkspace";
import { JobsIndex } from "@/components/jobs/JobsIndex";
import { useJobsLoad } from "@/hooks/useJobsLoad";
import { useAppStore } from "@/store/app-store";

/** Jobs: the index (bulk toolbar with `Run job`, `New job`, the list) or, when a row is open, that job's workspace. The
 *  page is the only reader of `workspaces.jobs`. It loads the jobs when first shown in a session and when another tab's
 *  write marked them stale; a running catalog job's end is read by a Refresh, never by a timer. */
export function JobsPage({ active }: PageProps) {
  const openId = useAppStore((state) => state.workspaces.jobs);
  useJobsLoad(active);
  return (
    <TabPage active={active} label="Jobs">
      {openId === null ? <JobsIndex /> : <JobWorkspace id={openId} active={active} />}
    </TabPage>
  );
}
