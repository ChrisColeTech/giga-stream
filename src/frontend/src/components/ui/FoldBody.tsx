import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_P2P, SECTION_FOLD_S } from "@/constants/timing";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** The folding body: a height and opacity tween (framer-motion, point-to-point, none under reduced motion). Its content
 *  stays mounted while folded; a folded body is hidden from assistive tech and inert, so it takes no focus. */
export function FoldBody({ open, className, children }: { open: boolean; className?: string; children?: ReactNode }) {
  const reduced = useReduceMotion();
  return (
    <motion.div
      className={`overflow-hidden ${className ?? ""}`}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: SECTION_FOLD_S, ease: EASE_P2P }}
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </motion.div>
  );
}
