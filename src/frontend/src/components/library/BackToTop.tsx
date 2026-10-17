import type { RefObject } from "react";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { backToTopBehavior } from "@/lib/back-to-top";
import { useBackToTop } from "@/hooks/useBackToTop";
import { BackToTopButton } from "./BackToTopButton";

export interface BackToTopProps {
  /** The Library's own scroller; the button floats over its bottom-right corner. */
  readonly scroller: RefObject<HTMLElement | null>;
}

/** Returns a Library list to its top. Absent until the list is scrolled past a viewport. */
export function BackToTop({ scroller }: BackToTopProps) {
  const visible = useBackToTop(scroller);
  const reduce = useReduceMotion();
  if (!visible) return null;
  return <BackToTopButton onClick={() => scroller.current?.scrollTo({ top: 0, behavior: backToTopBehavior(reduce) })} />;
}
