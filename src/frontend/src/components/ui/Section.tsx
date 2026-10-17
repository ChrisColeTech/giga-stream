import type { ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/cn";
import { Disclosure } from "./Disclosure";
import { Tip } from "./Tip";

export interface SectionProps {
  /** Stable id: the key the section's fold state is kept under in the store, so it survives a surface switch. */
  readonly id: string;
  readonly title: string;
  /** The explanation behind the info glyph, when the section has one. */
  readonly info?: string;
  readonly children: ReactNode;
}

/**
 * THE ONE COLLAPSIBLE SECTION of a sidebar (the family's accordion, Giga Images' `components/ui/Section`).
 *
 * The header always stays on screen. An open section takes the free height of its pane and its body scrolls inside
 * it, so the pane never scrolls as one long page. A closed section is its header and nothing else, so closed sections
 * stack as a run of bars. Headers are sentence case in the sans face, which separates them from the mono parameter keys
 * inside. The triangle is the spec's (`06` section 2, rule 8).
 *
 * The parent must be a flex column of a definite height (`min-h-0 flex-1 flex-col`); the section fills what it is given.
 */
export function Section({ id, title, info, children }: SectionProps) {
  const folded = useAppStore((state) => state.folded[id] === true);
  const toggle = useAppStore((state) => state.toggleFold);

  return (
    <section
      data-section={id}
      className={cn(
        "flex min-w-0 flex-col border-b border-hair",
        folded ? "flex-none" : "min-h-0 flex-1 basis-0",
      )}
    >
      <div className="flex h-8 flex-none items-center gap-1 pr-2">
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => toggle(id)}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-2.5 text-left font-sans text-[11px] font-semibold text-faint transition-colors duration-fade ease-linear hover:text-text focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)]"
        >
          <Disclosure open={!folded} />
          <span className="min-w-0 truncate">{title}</span>
        </button>
        {info !== undefined && <Tip text={info} />}
      </div>
      {!folded && <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-0.5 pb-3">{children}</div>}
    </section>
  );
}
