import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_JOB_LABELS } from "@/constants/job-copy";
import { useJobBulk } from "@/hooks/useJobBulk";
import { JobsList } from "./JobsList";
import { NewJobForm } from "./NewJobForm";

/** The Jobs index: the page toolbar holding the `Run job` promote (`55` decision 6) over `New job` and the list,
 *  whose first row holds the bulk verbs. One bulk instance drives both bars. */
export function JobsIndex() {
  const { verbs, promote } = useJobBulk();
  return (
    <>
      <IndexToolbar tab="jobs" promote={promote} />
      <Workspace labels={NEW_JOB_LABELS} fill>
        <NewJobForm />
        <JobsList verbs={verbs} />
      </Workspace>
    </>
  );
}
