import type { ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import { Disclosure } from "./Disclosure";
import { FoldBody } from "./FoldBody";

export interface RailSectionProps {
  /** Stable id: the key the section's fold state is kept under in the store. */
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

/** A collapsible rail group (`06` section 2, rule 8): a filled triangle and a title; the whole header row folds the
 *  body, and the fold state survives a surface switch. */
export function RailSection({ id, title, children }: RailSectionProps) {
  const folded = useAppStore((state) => state.folded[id] === true);
  const toggle = useAppStore((state) => state.toggleFold);

  return (
    <section data-rail-section={id} className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={!folded}
        onClick={() => toggle(id)}
        className="flex h-7 w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent px-2 text-left font-mono text-[11px] font-semibold text-muted hover:text-text"
      >
        <Disclosure open={!folded} />
        <span className="min-w-0 truncate">{title}</span>
      </button>
      <FoldBody open={!folded} className="flex flex-col gap-0.5 px-1 pb-2">
        {children}
      </FoldBody>
    </section>
  );
}
