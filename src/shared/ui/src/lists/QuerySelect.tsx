import { Select } from "../controls/Select";
import { FIELD_CONTROL } from "../form/form-classes";

export interface QueryChoice<V extends string> {
  readonly value: V;
  readonly label: string;
}

export interface QuerySelectProps<V extends string> {
  /** The select's accessible name and its tooltip (`Kind`). */
  readonly label: string;
  readonly value: V;
  readonly options: readonly QueryChoice<V>[];
  readonly onChange: (value: V) => void;
  /** The select's width: the sort select is wider than a filter. */
  readonly width?: "w-[150px]" | "w-[190px]";
  /** Why it waits (a bulk run is going); the select is natively disabled and the reason is its tooltip. */
  readonly reason?: string;
}

/** One select of a list's first row, LoRA Studio `LibraryToolbar`'s sort select: a fixed width, `flex-none`, the field
 *  control's height. The value is read back through the options, so a value that is not one is never taken. */
export function QuerySelect<V extends string>({ label, value, options, onChange, width = "w-[150px]", reason }: QuerySelectProps<V>) {
  return (
    <span className={`${width} flex-none`} title={reason}>
      <Select
        value={value}
        aria-label={label}
        title={reason ?? label}
        disabled={reason !== undefined}
        className={FIELD_CONTROL}
        onChange={(event) => {
          const picked = options.find((option) => option.value === event.target.value);
          if (picked !== undefined) onChange(picked.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </span>
  );
}
