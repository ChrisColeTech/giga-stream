import { Clock } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { INTERVAL_TIP } from "@/constants/job-copy";

export interface JobScheduleGroupProps {
  readonly value: string;
  /** The page's own check or the backend's `422 job.invalid` (field `schedule`), under the row. */
  readonly error: string | undefined;
  readonly onChange: (schedule: string) => void;
}

/** `Schedule` (`38` section 4.3): the Interval, mono text (`6h`, `30m`, `24h` or `off`, in the tip). The page checks
 *  it on Save; a bad value is the row's error and the notice, and the backend normalises a good one. */
export function JobScheduleGroup({ value, error, onChange }: JobScheduleGroupProps) {
  return (
    <Group id="jw-schedule" icon={Clock} title="Schedule">
      <Row label="Interval" tip={INTERVAL_TIP} error={error}>
        <Input
          type="text"
          value={value}
          className={`${FIELD_CONTROL} font-mono`}
          aria-label="Interval"
          aria-invalid={error !== undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      </Row>
    </Group>
  );
}
