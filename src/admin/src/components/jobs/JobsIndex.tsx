import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_JOB_LABELS } from "@/constants/job-copy";
import { JobsList } from "./JobsList";
import { NewJobForm } from "./NewJobForm";

/** The Jobs index: `New job` and the list, whose table strip holds the bulk verbs and `Run job`. No page toolbar. */
export function JobsIndex() {
  return (
    <Workspace labels={NEW_JOB_LABELS}>
      <NewJobForm />
      <JobsList />
    </Workspace>
  );
}
