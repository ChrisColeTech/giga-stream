import { cn } from "../lib/cn";

/** The fields of an events row this component draws. The app's own row type carries these and more. */
export interface EventRowFields {
  /** Unix milliseconds. */
  readonly at: number;
  readonly tone: "info" | "warn" | "error";
  /** The area the row belongs to, e.g. "Connection". */
  readonly area: string;
  readonly sentence: string;
  /** A short identity, when the row is about one item. */
  readonly identity?: string;
}

export interface EventRowProps {
  readonly row: EventRowFields;
}

/* The tone is a colored word (never a dot): it says the same thing the color does. */
const TONE: Readonly<Record<EventRowFields["tone"], { word: string; color: string }>> = {
  info: { word: "info", color: "text-dim" },
  warn: { word: "warn", color: "text-st-loading" },
  error: { word: "error", color: "text-st-failed" },
};

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** One row of the events log: time, tone, area, the sentence, and the item it is about, in mono. */
export function EventRow({ row }: EventRowProps) {
  const tone = TONE[row.tone];
  return (
    <div className="flex min-h-4 items-baseline gap-2.5 py-px">
      <span className="flex-none text-dim tabular-nums">{clock(row.at)}</span>
      <span className={cn("w-10 flex-none", tone.color)}>{tone.word}</span>
      <span className="w-20 flex-none truncate text-faint">{row.area}</span>
      <span className={cn("min-w-0 flex-1 truncate", row.tone === "error" ? "text-st-failed" : "text-muted")} title={row.sentence}>
        {row.sentence}
      </span>
      {row.identity !== undefined && <span className="flex-none truncate text-dim">{row.identity}</span>}
    </div>
  );
}
