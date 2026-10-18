import { Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { DRY_RUN_TIP, PRUNE_TIP, RUN_JOB } from "@/constants/job-copy";
import { togglesOf, type RunToggles } from "@/lib/job-draft";
import type { JobResult } from "@/services/job-flows";
import type { AdminJob } from "@/services/schemas/job-schema";

export interface JobRunGroupProps {
  readonly job: AdminJob;
  /** Why `Run job` cannot run now (`Save the job first`, `Running.`, the gate's reasons); undefined when it can. */
  readonly reason: string | undefined;
  readonly onRun: (toggles: RunToggles) => Promise<JobResult>;
}

/** `Run` (`38` section 4.3): a playlist job's `Dry run` and `Prune` switches, starting from the job's own flags and
 *  sent with this run only (never saved), then the one primary `Run job`. A refusal (`sync.busy`, `job.disabled` with
 *  its reason, `tmdb.unavailable`, `playlist.unreachable`, `playlist.invalid`, `playlist.busy`) is the control's error
 *  under it, and the notice. */
export function JobRunGroup({ job, reason, onRun }: JobRunGroupProps) {
  const [toggles, setToggles] = useState<RunToggles>(() => togglesOf(job));
  const [error, setError] = useState<string | null>(null);
  const playlist = job.type === "playlist";

  const run = async (): Promise<void> => {
    if (reason !== undefined) return;
    setError(null);
    const result = await onRun(toggles);
    if (!result.ok && result.dropped !== true) setError(result.sentence);
  };

  return (
    <Group id="jw-run" icon={Play} title="Run">
      {playlist && (
        <>
          <Row label="Dry run" tip={DRY_RUN_TIP}>
            <Toggle
              checked={toggles.dryRun}
              aria-label="Dry run"
              onChange={(dryRun) => setToggles((now) => ({ ...now, dryRun }))}
            />
          </Row>
          <Row label="Prune" tip={PRUNE_TIP}>
            <Toggle
              checked={toggles.prune}
              aria-label="Prune"
              onChange={(prune) => setToggles((now) => ({ ...now, prune }))}
            />
          </Row>
        </>
      )}
      <Actions>
        <Button variant="primary" reason={reason} onClick={() => void run()}>
          {RUN_JOB}
        </Button>
      </Actions>
      {error !== null && (
        <p className="m-0 text-right text-sm leading-5 text-st-failed" role="alert">
          {error}
        </p>
      )}
    </Group>
  );
}
