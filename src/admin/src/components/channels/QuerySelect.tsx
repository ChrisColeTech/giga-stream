import { Select } from "@giga/ui/controls/Select";
import type { QueryOption } from "@/constants/channel-query-copy";

export interface QuerySelectProps<V extends string> {
  /** The select's accessible name (`Kind`). */
  readonly label: string;
  readonly value: V;
  readonly options: readonly QueryOption<V>[];
  readonly onChange: (value: V) => void;
  /** Why it waits (a bulk run is going); the select is natively disabled and the reason is its tooltip. */
  readonly reason?: string;
}

/** One compact select of the list's first row (LoRA Studio `LibraryToolbar`'s sort select, at the small control height
 *  the strip's buttons have). The value is read back through the options, so a value that is not one is never taken. */
export function QuerySelect<V extends string>({ label, value, options, onChange, reason }: QuerySelectProps<V>) {
  return (
    <span className="w-36 flex-none" title={reason}>
      <Select
        value={value}
        aria-label={label}
        title={reason ?? label}
        disabled={reason !== undefined}
        className="h-ctl-sm! px-2! text-xs!"
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
