import { cn } from "@/lib/cn";

export interface ProgressBarProps {
  /** From 0 to 1. */
  readonly ratio: number;
  readonly className?: string;
}

/** A thin track with the accent filling it to the watched share. The words for the same fact sit beside it. */
export function ProgressBar({ ratio, className }: ProgressBarProps) {
  return (
    <span aria-hidden className={cn("block h-[3px] w-full overflow-hidden bg-hair", className)}>
      <span className="block h-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </span>
  );
}
