import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { CUSTOM_TIP, INTERVAL_TIP } from "@/constants/job-copy";
import { CUSTOM, CUSTOM_SEED, SCHEDULE_OPTIONS, scheduleChoice } from "@/lib/job-schedule";

export interface JobScheduleRowsProps {
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (schedule: string) => void;
}

/** The shared New/Edit schedule fields: the preset picker and, only for Custom, its entered interval. */
export function JobScheduleRows({ value, error, onChange }: JobScheduleRowsProps) {
  const choice = scheduleChoice(value);
  const custom = choice === CUSTOM;
  return (
    <>
      <Row label="Interval" tip={INTERVAL_TIP} error={custom ? undefined : error}>
        <Select
          value={choice}
          className={FIELD_CONTROL}
          aria-label="Interval"
          aria-invalid={!custom && error !== undefined}
          onChange={(event) => onChange(event.target.value === CUSTOM ? CUSTOM_SEED : event.target.value)}
        >
          {SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
    </>
  );
}
