import { ArrowDown, ArrowUp } from "lucide-react";
import { IconButton } from "../controls/IconButton";
import { QuerySelect, type QueryChoice } from "./QuerySelect";

export type SortDirection = "asc" | "desc";

export interface SortControlProps<V extends string> {
  /** The sort select's accessible name and tooltip (`Sort`). */
  readonly label: string;
  readonly value: V;
  readonly options: readonly QueryChoice<V>[];
  readonly onChange: (value: V) => void;
  /** A sort with a direction draws the small toggle beside the select; one without (TMDB's) draws none. */
  readonly direction?: { readonly value: SortDirection; readonly onToggle: () => void };
  readonly reason?: string;
}

const WORDS: Record<SortDirection, { readonly now: string; readonly press: string }> = {
  asc: { now: "ascending", press: "descending" },
  desc: { now: "descending", press: "ascending" },
};

/** The sort of a list's query row: a compact select that shows the sort's name (never self-labelled, it always has a
 *  value) and, when the sort has a direction, a small icon toggle whose tooltip says the order now and what a press does. */
export function SortControl<V extends string>({ label, value, options, onChange, direction, reason }: SortControlProps<V>) {
  const words = direction === undefined ? undefined : WORDS[direction.value];
  const Glyph = direction?.value === "desc" ? ArrowDown : ArrowUp;
  return (
    <span className="inline-flex flex-none items-center gap-1">
      <QuerySelect plain label={label} value={value} options={options} onChange={onChange} {...(reason !== undefined && { reason })} />
      {direction !== undefined && words !== undefined && (
        <IconButton
          aria-label={`${label} direction, ${words.now}`}
          title={`Sorted ${words.now}. Press for ${words.press}.`}
          className="size-ctl-sm! border-border! bg-surface!"
          disabled={reason !== undefined}
          onClick={direction.onToggle}
        >
          <Glyph aria-hidden className="size-3" />
        </IconButton>
      )}
    </span>
  );
}
