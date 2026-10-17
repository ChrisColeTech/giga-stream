import { motion } from "framer-motion";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { COLLAPSE_S, EASE_P2P } from "@/constants/timing";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/app-store";

/* A COLLAPSIBLE BOTTOM PANEL, not a side drawer: a flex-none child of the app sitting between the pages and the
 * statusbar. No fixed position, no slide-from-side. Its height is a framer-motion tween (the family's one motion
 * engine), skipped under reduced motion. The panel stays mounted so the log keeps appending while it is closed. */
const OPEN_HEIGHT = 190;
const DRAWER = "flex flex-none flex-col overflow-hidden border-t border-border bg-surface";
const SCROLL = "min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5 font-mono text-xs";
const WIDTHS = ["62%", "48%", "71%", "39%", "55%"];

export function EventsDrawer() {
  const open = useAppStore((state) => state.eventsOpen);
  const reduced = useReduceMotion();

  return (
    <motion.div
      className={cn(DRAWER, !open && "border-t-0")}
      initial={false}
      animate={{ height: open ? OPEN_HEIGHT : 0 }}
      transition={reduced ? { duration: 0 } : { duration: COLLAPSE_S, ease: EASE_P2P }}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="flex h-7.5 flex-none items-center gap-2.5 border-b border-hair bg-panel px-2.5 py-1">
        <span className="font-mono text-[11px] font-semibold text-faint">Events</span>
        <span className="ml-auto truncate font-mono text-[11px] text-dim" />
      </div>
      <div className={SCROLL}>
        {/* Shimmer lines, not a sentence: the empty state of a log that has nothing to say yet. */}
        <div className="pointer-events-none" aria-hidden>
          {WIDTHS.map((width) => (
            <div key={width} className="flex min-h-4 items-center py-px">
              <span className={cn(SHIMMER, "h-2")} style={{ width }} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
