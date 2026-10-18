import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_JOB_LABELS } from "@/constants/job-copy";
import { JobsList } from "./JobsList";
import { NewJobForm } from "./NewJobForm";

/** The Jobs index: the page toolbar, empty (the Jobs index has no forward verb, `28` section 7.2), over `New job` and the
 *  list, whose first row holds the bulk verbs and `Run job`. */
export function JobsIndex() {
  return (
    <>
      <IndexToolbar tab="jobs" />
      <Workspace labels={NEW_JOB_LABELS} fill>
        <NewJobForm />
        <JobsList />
      </Workspace>
    </>
  );
}
