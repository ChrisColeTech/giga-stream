/* A job's schedule as the person reads it (`38` section 4.3), pure. The backend stores `off` or a whole number with a
 * unit (`ms`, `s`, `m`, `h`) in its largest exact unit (`60m` is stored `1h`); the picker offers the usual ones and
 * `Custom...` for the rest. A stored value outside the list is never changed: it shows as Custom with its own text. */

export const SCHEDULE_OFF = "off";
/** The picker's value for `Custom...`; never a schedule itself. */
export const CUSTOM = "custom";
/** What choosing `Custom...` starts the text field with (not one of the listed values, so the field stays shown). */
export const CUSTOM_SEED = "2h";

export interface ScheduleOption {
  readonly value: string;
  readonly label: string;
}

export const SCHEDULE_OPTIONS: readonly ScheduleOption[] = [
  { value: SCHEDULE_OFF, label: "Off" },
  { value: "15m", label: "Every 15 minutes" },
  { value: "30m", label: "Every 30 minutes" },
  { value: "1h", label: "Every hour" },
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every day" },
];

const normal = (value: string): string => value.trim().toLowerCase();

/** The picker's value for a schedule: the listed one it equals, or `custom`. */
export function scheduleChoice(value: string): string {
  const text = normal(value);
  return SCHEDULE_OPTIONS.some((option) => option.value === text) ? text : CUSTOM;
}

const UNITS: Readonly<Record<string, readonly [string, string]>> = {
  ms: ["millisecond", "milliseconds"],
  s: ["second", "seconds"],
  m: ["minute", "minutes"],
  h: ["hour", "hours"],
};

/** A schedule in words, the same words as the picker (`Off`, `Every 6 hours`); a value that is none of the backend's
 *  forms is returned as it is. */
export function scheduleLabel(value: string): string {
  const text = normal(value);
  const listed = SCHEDULE_OPTIONS.find((option) => option.value === text);
  if (listed !== undefined) return listed.label;
  const match = /^(\d+)(ms|s|m|h)$/.exec(text);
  const unit = match?.[2] === undefined ? undefined : UNITS[match[2]];
  if (match?.[1] === undefined || unit === undefined) return value;
  const count = Number(match[1]);
  return count === 1 ? `Every ${unit[0]}` : `Every ${count} ${unit[1]}`;
}

/** Whether a job runs by itself: `Scheduled`, `Not scheduled` (schedule off) or `Disabled` (never runs at all). */
export function scheduleStatus(job: { readonly enabled: boolean; readonly schedule: string }): string {
  if (!job.enabled) return "Disabled";
  return normal(job.schedule) === SCHEDULE_OFF ? "Not scheduled" : "Scheduled";
}
