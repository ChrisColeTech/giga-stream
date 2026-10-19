import { Clock } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { STATUS_TIP } from "@/constants/job-copy";
import { scheduleStatus } from "@/lib/job-schedule";
import type { AdminJob } from "@/services/schemas/job-schema";
import { JobScheduleRows } from "./JobScheduleRows";

export interface JobScheduleGroupProps {
  readonly value: string;
  /** The saved job: its Status row reads `Scheduled`, `Not scheduled` or `Disabled` from what is stored. */
  readonly job: Pick<AdminJob, "enabled" | "schedule">;
  /** The page's own check or the backend's `422 job.invalid` (field `schedule`), under the row. */
  readonly error: string | undefined;
  readonly onChange: (schedule: string) => void;
}

const FACT = "flex h-9 items-center font-mono text-sm text-muted";

/** `Schedule` (`38` section 4.3): the Interval picker (Off, Every 15 minutes ... Every day, Custom...), the text field
 *  only for Custom (a stored value outside the list opens as Custom with its own text), and the saved Status. The
 *  backend does not say when the next run is due, so none is shown. The page checks a custom value on Save. */
export function JobScheduleGroup({ value, job, error, onChange }: JobScheduleGroupProps) {
  return (
    <Group id="jw-schedule" icon={Clock} title="Schedule">
      <JobScheduleRows value={value} error={error} onChange={onChange} />
      <Row label="Status" tip={STATUS_TIP}>
        <span className={FACT}>{scheduleStatus(job)}</span>
      </Row>
    </Group>
  );
}
