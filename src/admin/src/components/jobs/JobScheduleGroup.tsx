import { Clock } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { CUSTOM_TIP, INTERVAL_TIP, STATUS_TIP } from "@/constants/job-copy";
import { CUSTOM, CUSTOM_SEED, SCHEDULE_OPTIONS, scheduleChoice, scheduleStatus } from "@/lib/job-schedule";
import type { AdminJob } from "@/services/schemas/job-schema";

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
  const choice = scheduleChoice(value);
  const custom = choice === CUSTOM;
  return (
    <Group id="jw-schedule" icon={Clock} title="Schedule">
      <Row label="Interval" tip={INTERVAL_TIP} error={custom ? undefined : error}>
        <Select
          value={choice}
          className={FIELD_CONTROL}
          aria-label="Interval"
          aria-invalid={!custom && error !== undefined}
          onChange={(event) => onChange(event.target.value === CUSTOM ? CUSTOM_SEED : event.target.value)}
        >
          {SCHEDULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom...</option>
        </Select>
      </Row>
      {custom && (
        <Row label="Custom interval" tip={CUSTOM_TIP} error={error}>
          <Input
            type="text"
            value={value}
            className={`${FIELD_CONTROL} font-mono`}
            aria-label="Custom interval"
            aria-invalid={error !== undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        </Row>
      )}
      <Row label="Status" tip={STATUS_TIP}>
        <span className={FACT}>{scheduleStatus(job)}</span>
      </Row>
    </Group>
  );
}
