import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_JOB_LABELS } from "@/constants/job-copy";
import { JobsList } from "./JobsList";
import { JobsToolbar } from "./JobsToolbar";
import { NewJobForm } from "./NewJobForm";

/** The Jobs index: the toolbar (bulk verbs and the filled `Run job`) over `New job` and the list. */
export function JobsIndex() {
  return (
    <>
      <JobsToolbar />
      <Workspace labels={NEW_JOB_LABELS}>
        <NewJobForm />
        <JobsList />
      </Workspace>
    </>
  );
}
