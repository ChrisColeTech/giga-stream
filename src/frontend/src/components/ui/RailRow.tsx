import type { ComponentType, MouseEvent } from "react";
import { cn } from "@/lib/cn";

export interface RailRowProps {
  readonly label: string;
  readonly icon?: ComponentType<{ className?: string }>;
  /** Shown at the right, when given (a collection's count, a view's count). */
  readonly count?: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
  /** Summons the row's context menu at the pointer, when the row has one. */
  readonly onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly disabled?: boolean;
  readonly reason?: string;
}

/** A rail row (`06` section 4.1, family rail rows): 32 px tall, 13 px text, a 2 px accent bar on the selected row. */
export function RailRow({ label, icon: Icon, count, selected, onSelect, onContextMenu, disabled = false, reason }: RailRowProps) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      disabled={disabled}
      title={reason}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={cn(
        "flex h-8 w-full cursor-pointer items-center gap-2 border-0 border-l-2 pr-2 pl-2.5 text-left font-sans text-[13px]",
        "transition-[background,color] duration-fade ease-linear focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        selected
          ? "border-l-accent bg-accent-tint text-accent-text"
          : "border-l-transparent bg-transparent text-muted hover:bg-hov hover:text-text",
      )}
    >
      {Icon !== undefined && <Icon className="size-3.75 flex-none" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="font-mono text-[11px] text-dim tabular-nums">{count}</span>}
    </button>
  );
}
