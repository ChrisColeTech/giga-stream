import { CircleStop, Play } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { RESUME_JOB, RESUME_TIP, RUN_JOB, RUN_TIP, STOP_JOB, STOP_TIP } from "@/constants/job-copy";
import type { JobResult } from "@/services/job-flows";

export interface JobRunGroupProps {
  /** Why `Run job` cannot run now (`Save the job first`, `Running.`, the gate's reasons); undefined when it can. */
  readonly reason: string | undefined;
  /** Why `Stop` cannot stop now (`Not running.`, `Stopping.`); undefined while the job runs. */
  readonly stopReason: string | undefined;
  /** The last run was stopped: the run button reads `Resume` and the same call continues it. */
  readonly resume: boolean;
  readonly onRun: () => Promise<JobResult>;
  readonly onStop: () => Promise<JobResult>;
}

/** `Run` (`38` section 4.3, `43` sections 3.4a and 4.1): the ghost `Run job` (`Resume` after a stop) with a ghost `Stop`
 *  beside it (the form's one primary is `Save details`). The backend STARTS the job and answers at once; the notice says
 *  `Started <name>.` or `Stopping <name>.` and the result is read on Refresh. A refusal (`sync.busy`, `job.disabled`
 *  with its reason, `tmdb.unavailable`, `job.not_running`) is said once, on the notice line, by the flow. There are no
 *  `Dry run` and `Prune` switches: a sync never deletes, and `Disable` over a filter replaces prune. */
export function JobRunGroup({ reason, stopReason, resume, onRun, onStop }: JobRunGroupProps) {
  const press = (reasonNow: string | undefined, call: () => Promise<JobResult>) => (): void => {
    if (reasonNow === undefined) void call();
  };

  return (
    <Group id="jw-run" icon={Play} title="Run">
      <Actions>
        <Button variant="ghost" title={resume ? RESUME_TIP : RUN_TIP} reason={reason} onClick={press(reason, onRun)}>
          {resume ? RESUME_JOB : RUN_JOB}
        </Button>
        <Button variant="ghost" title={STOP_TIP} reason={stopReason} onClick={press(stopReason, onStop)}>
          <CircleStop className="size-3.5" aria-hidden />
          {STOP_JOB}
        </Button>
      </Actions>
    </Group>
  );
}
