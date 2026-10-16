import type { ComponentType } from "react";
import { cn } from "@/lib/cn";

export interface RailEntry<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

/* THE WORK SURFACE'S RAIL (the family's `OverlayRail`): one width for every rail, 150px, on the page background with a
 * hairline down its right edge. Each entry is 32px with a leading icon and a 13px label; the active one wears a 2px
 * accent bar, accent text and the accent tint, a hovered one the hover fill. The arrows and Home/End walk it, and the
 * host owns what a selection shows. */
export function Rail<T extends string>({
  label,
  entries,
  selected,
  onSelect,
}: {
  label: string;
  entries: ReadonlyArray<RailEntry<T>>;
  selected: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={label}
      className="flex w-[150px] flex-none flex-col overflow-y-auto border-r border-hair bg-bg py-1.5"
    >
      {entries.map(({ id, label: text, icon: Icon }, index) => {
        const on = id === selected;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
              const to = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : step === 0 ? -1 : index + step;
              const next = entries[to];
              if (next === undefined) return;
              event.preventDefault();
              onSelect(next.id);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[to]?.focus();
            }}
            className={cn(
              /* No `bg-transparent` in the base: `cn()` is a plain join, so it would share a layer with the lit
                 state's `bg-accent-tint` and win on stylesheet order. Each state names its own fill. */
              "flex h-8 w-full cursor-pointer items-center gap-2 border-0 border-l-2 pr-2 pl-3 text-left " +
                "font-sans text-[13px] transition-[background,color] duration-fade ease-linear focus-visible:outline-none",
              on
                ? "border-l-accent bg-accent-tint text-accent-text"
                : "border-l-transparent bg-transparent text-muted hover:bg-hov hover:text-text",
            )}
          >
            <Icon className="size-3.75 flex-none" />
            <span className="min-w-0 truncate">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
