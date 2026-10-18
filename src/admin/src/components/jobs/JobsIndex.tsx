import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_JOB_LABELS } from "@/constants/job-copy";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { JobsList } from "./JobsList";
import { NewJobForm } from "./NewJobForm";

/** The Jobs index: the (empty) page toolbar over `New job` and the list, whose table strip holds the bulk verbs and
 *  `Run job`. */
export function JobsIndex() {
  return (
    <>
      <IndexToolbar frame={INDEX_FRAMES.jobs} />
      <Workspace labels={NEW_JOB_LABELS}>
        <NewJobForm />
        <JobsList />
      </Workspace>
    </>
  );
}
