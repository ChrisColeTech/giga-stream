import type { ComponentType, ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import { Disclosure } from "./Disclosure";
import { FoldBody } from "./FoldBody";
import { Tip } from "./Tip";

export interface GroupProps {
  /** Stable id: the key the group's fold state is kept under. */
  readonly id: string;
  readonly title: string;
  readonly icon: ComponentType<{ className?: string }>;
  /** The explanation, as a tooltip on the info glyph at the right of the title. */
  readonly tip?: string;
  /** The last group draws no rule under itself. */
  readonly last?: boolean;
  readonly children: ReactNode;
}

/* THE PAGE GRAMMAR'S GROUP: the family heading, an icon tile, a mono title, the info glyph at the right of the title and
 * the fold chevron at the far right, at the app's density (a 32px tile, a 16px mono title), a body laid out as the
 * responsive form grid, and the accent-cored rule the group draws itself between one section and the next. The heading
 * button is the one keyboard and assistive control; the chevron is a second mouse target for it. Fold state is the
 * store's, and the body folds with framer-motion. */
export function Group({ id, title, icon: Icon, tip, last = false, children }: GroupProps) {
  const folded = useAppStore((state) => state.folded[id] === true);
  const toggle = useAppStore((state) => state.toggleFold);

  return (
    <section data-group={id} className="flex min-w-0 flex-col pt-3">
      <div className="flex min-w-0 items-center gap-2 pb-2.5">
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => toggle(id)}
          className="group/heading flex min-w-0 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-text"
        >
          <span
            aria-hidden
            className="grid size-8 flex-none place-items-center rounded-card border border-hair bg-accent-tint text-accent-text"
          >
            <Icon className="size-4" />
          </span>
          <h2 className="m-0 font-mono text-base leading-[22px] font-semibold group-hover/heading:text-accent-text">{title}</h2>
        </button>
        {tip !== undefined && <Tip text={tip} />}
        <span className="min-w-0 flex-1" />
        <span aria-hidden className="grid size-7 flex-none cursor-pointer place-items-center text-muted" onClick={() => toggle(id)}>
          <Disclosure open={!folded} />
        </span>
      </div>
      <FoldBody open={!folded} className="flex flex-col gap-1">
        {children}
        <span aria-hidden className="h-4 flex-none" />
      </FoldBody>
      {!last && (
        <span
          aria-hidden
          className="block h-px w-full flex-none bg-[linear-gradient(90deg,transparent_0%,var(--color-hair)_15%,var(--color-accent-edge)_50%,var(--color-hair)_85%,transparent_100%)]"
        />
      )}
    </section>
  );
}
