import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { ROWS_COPY } from "./rows-constants";

export interface RowChevronProps {
  readonly direction: "back" | "forward";
  /** At the row's end in this direction: the press does nothing, and the reason is the tooltip. */
  readonly disabled: boolean;
  readonly onClick: () => void;
}

/* The chevron's wrapper fills the row's height and is click-through until the row is hovered or focused, so the row's
   cards underneath stay usable. The button keeps its own disabled look and tooltip. */
const CHEVRON =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-ctl-edge text-muted " +
  "bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] " +
  "shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] " +
  "transition-[border-color,color] duration-fade ease-linear " +
  "hover:border-dim hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";

/** One of a shelf row's two edge chevrons. It is a real button with an accessible name. */
export function RowChevron({ direction, disabled, onClick }: RowChevronProps) {
  const isBack = direction === "back";
  const label = isBack ? ROWS_COPY.scrollBack : ROWS_COPY.scrollForward;
  const Icon = isBack ? ChevronLeft : ChevronRight;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex items-center opacity-0 transition-opacity duration-fade ease-linear",
        "group-hover/row:pointer-events-auto group-hover/row:opacity-100",
        "group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100",
        isBack ? "left-1" : "right-1",
      )}
    >
      <button
        type="button"
        aria-label={label}
        title={disabled ? (isBack ? ROWS_COPY.atStart : ROWS_COPY.atEnd) : label}
        disabled={disabled}
        onClick={onClick}
        className={CHEVRON}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
