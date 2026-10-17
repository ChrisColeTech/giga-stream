import type { ReactNode } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { FoldBody } from "@/components/ui/FoldBody";
import { Tip } from "@/components/ui/Tip";
import { useAppStore } from "@/store/app-store";

export interface InspectorGroupProps {
  /** Stable id: the key the fold state is kept under in the store, so it survives a surface switch. */
  readonly id: string;
  readonly title: string;
  /** The explanation behind the info glyph. */
  readonly info: string;
  readonly children: ReactNode;
}

/** One inspector block (`21` section 3.4a, Cut's group): a header row with a filled triangle, the title and the info glyph.
 *  The header's button folds the body. */
export function InspectorGroup({ id, title, info, children }: InspectorGroupProps) {
  const folded = useAppStore((state) => state.folded[id] === true);
  const toggle = useAppStore((state) => state.toggleFold);
  return (
    <section data-inspector-group={id} className="flex min-w-0 flex-none flex-col border-b border-hair">
      <div className="flex h-7 items-center gap-1 pr-2">
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => toggle(id)}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-2 text-left font-mono text-[11px] font-semibold text-muted hover:text-text"
        >
          <Disclosure open={!folded} />
          <span className="min-w-0 truncate">{title}</span>
        </button>
        <Tip text={info} />
      </div>
      <FoldBody open={!folded} className="flex flex-col gap-0.5 pb-2">
        {children}
      </FoldBody>
    </section>
  );
}
