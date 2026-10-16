import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Rendered before the label, an icon usually. */
  icon?: ReactNode;
  /** A choice this state of the world cannot serve. It stays in the track, dimmed and unpressable, with its reason
   *  in `disabledReason`: disabled, never hidden. */
  disabled?: boolean;
  disabledReason?: string;
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  /** Shorter segments, for a 30px bar like the events drawer's. */
  dense?: boolean;
  className?: string;
}

/* A RECESSED TRACK HOLDING RAISED CHIPS, not a bordered strip with dividers. The track is --surface (darker than the
 * panel, so it reads sunken) with 2px of padding; the active chip gets the same top-lit gradient and drop as a button,
 * so "selected" reads as raised rather than merely tinted. `flex-none` so a settings row cannot squeeze the track below
 * its labels, and `overflow-hidden` so a narrow rail clips a label rather than wrapping it onto a second line. */
const SEG_TRACK =
  "inline-flex flex-none gap-0.5 overflow-hidden rounded-ctl border border-ctl-edge bg-surface p-0.5";

const SEG_BUTTON =
  "inline-flex min-w-0 grow cursor-pointer items-center justify-center gap-1.25 rounded-[3px] border-0 " +
  "bg-transparent whitespace-nowrap text-muted transition-[background,color,box-shadow] duration-fade ease-linear " +
  "hover:text-text " +
  "data-active:bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] " +
  "data-active:font-semibold data-active:text-accent-text " +
  "data-active:shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)]";

/** A segmented control: one home for a small closed set of choices. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  dense = false,
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div role="group" className={cn(SEG_TRACK, className)} {...rest}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          data-active={option.value === value ? "" : undefined}
          disabled={option.disabled}
          title={option.disabled ? option.disabledReason : undefined}
          className={cn(
            SEG_BUTTON,
            "disabled:cursor-not-allowed disabled:text-dim disabled:hover:text-dim",
            dense ? "h-5 px-2.25 text-[11px]" : "h-[calc(var(--spacing-ctl-md)-6px)] px-2 text-xs",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
