import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export interface QueryChoice<V extends string> {
  readonly value: V;
  readonly label: string;
}

export interface QuerySelectProps<V extends string> {
  /** The select's accessible name, its tooltip and, at rest, its face (`Kind`). */
  readonly label: string;
  readonly value: V;
  /** The FIRST option is the default, worded for the open list (`Any kind`); picking it returns the filter to its name. */
  readonly options: readonly QueryChoice<V>[];
  readonly onChange: (value: V) => void;
  /** A choice rather than a filter (the sort): the face always shows the chosen option, in the text tone, never accent. */
  readonly plain?: boolean;
  /** Kept for the Channels row until it swaps to the new pieces; no longer used. */
  readonly width?: string;
  /** Why it waits (a bulk run is going); the select is natively disabled and the reason is its tooltip. */
  readonly reason?: string;
}

const BOX =
  "relative inline-flex h-ctl-sm flex-none items-center rounded-ctl border pr-5.5 pl-2 text-xs leading-none " +
  "transition-[border-color,box-shadow,color] duration-fade ease-linear " +
  "has-[:focus-visible]:border-accent has-[:focus-visible]:shadow-[0_0_0_2px_var(--color-accent-tint)] " +
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45";
const AT_REST = "border-border bg-surface text-dim hover:border-dim hover:text-text";
const CHOSEN = "border-border bg-surface text-text hover:border-dim";
const ACTIVE = "border-accent-edge bg-accent-tint text-accent-text hover:border-accent";

/** One select of a list's query row, LoRA Studio `LibraryToolbar`'s, compacted to the verbs' height and SELF-LABELLING:
 *  at its default it shows only the filter's name in the dim tone; with a value it shows that value in the accent tone
 *  inside an accent border, so an active filter is visible at a glance. The native select is laid invisibly over the face,
 *  so the open list, the keyboard and the accessibility tree are the platform's. The face is as wide as the widest of its
 *  texts, so choosing never moves its neighbours. */
export function QuerySelect<V extends string>({ label, value, options, onChange, plain = false, reason }: QuerySelectProps<V>) {
  const chosen = options.find((option) => option.value === value) ?? options[0];
  const active = !plain && chosen !== undefined && chosen !== options[0];
  const shown = plain || active ? (chosen?.label ?? label) : label;
  const widest = plain ? options.map((option) => option.label) : [label, ...options.slice(1).map((option) => option.label)];
  const tone = active ? ACTIVE : plain ? CHOSEN : AT_REST;
  return (
    <span className={cn(BOX, tone)} data-active={active ? "" : undefined} title={reason}>
      <select
        value={chosen?.value ?? value}
        aria-label={label}
        title={reason ?? (active ? `${label}: ${shown}` : label)}
        disabled={reason !== undefined}
        className="absolute inset-0 size-full cursor-pointer appearance-none bg-surface text-text opacity-0 disabled:cursor-not-allowed"
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
      </select>
      <span aria-hidden className="pointer-events-none grid">
        {widest.map((text, at) => (
          <span key={at} className="invisible col-start-1 row-start-1 whitespace-nowrap">
            {text}
          </span>
        ))}
        <span className="col-start-1 row-start-1 whitespace-nowrap">{shown}</span>
      </span>
      <ChevronDown
        aria-hidden
        className={cn("pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2", active ? "text-accent-text" : "text-faint")}
      />
    </span>
  );
}
