import { Play } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { RUN_JOB, RUN_TIP } from "@/constants/job-copy";
import type { JobResult } from "@/services/job-flows";

export interface JobRunGroupProps {
  /** Why `Run job` cannot run now (`Save the job first`, `Running.`, the gate's reasons); undefined when it can. */
  readonly reason: string | undefined;
  readonly onRun: () => Promise<JobResult>;
}

/** `Run` (`38` section 4.3, `43` section 4.1): the ghost `Run job` alone (the form's one primary is `Save details`). The
 *  backend STARTS the job and answers at once; the notice says `Started <name>.` and the result is read on Refresh. A
 *  refusal (`sync.busy`, `job.disabled` with its reason, `tmdb.unavailable`) is said once, on the notice line. There are
 *  no `Dry run` and `Prune` switches: a sync never deletes, and `Disable` over a filter replaces prune. */
export function JobRunGroup({ reason, onRun }: JobRunGroupProps) {
  /* A refusal is said once, on the notice line, by the flow that ran the job. */
  const run = async (): Promise<void> => {
    if (reason !== undefined) return;
    await onRun();
  };

  return (
    <Group id="jw-run" icon={Play} title="Run">
      <Actions>
        <Button variant="ghost" title={RUN_TIP} reason={reason} onClick={() => void run()}>
          {RUN_JOB}
        </Button>
      </Actions>
    </Group>
  );
}
