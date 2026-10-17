import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { COLLAPSE_S, EASE_P2P } from "@/constants/timing";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { cn } from "@giga/ui/lib/cn";
import { useAppStore } from "@/store/app-store";
import { EventRow } from "./EventRow";

/* A COLLAPSIBLE BOTTOM PANEL, not a side drawer: a flex-none child of the app sitting between the pages and the
 * statusbar, 160px open (`06` section 1.3). Its height is a framer-motion tween, skipped under reduced motion. It stays
 * mounted so the log keeps appending while it is closed. The head is the name, the row count and Clear; the body is the
 * log, newest at the foot and kept in view, or shimmer lines while it is empty. */
const OPEN_HEIGHT = 160;
const DRAWER = "flex flex-none flex-col overflow-hidden border-t border-border bg-surface";
const SCROLL = "min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5 font-mono text-xs";
const WIDTHS = ["62%", "48%", "71%", "39%", "55%"];
const HEAD_BUTTON =
  "inline-flex cursor-pointer items-center rounded-ctl border-0 bg-transparent px-1.5 py-0.5 font-sans text-xs " +
  "text-muted hover:bg-hov hover:text-text disabled:pointer-events-none disabled:opacity-45";

export function EventsDrawer() {
  const open = useAppStore((state) => state.eventsOpen);
  const events = useAppStore((state) => state.events);
  const clearEvents = useAppStore((state) => state.clearEvents);
  const reduced = useReduceMotion();
  const scroller = useRef<HTMLDivElement | null>(null);

  /* The newest row is at the foot; a new one scrolls into view. */
  useEffect(() => {
    const node = scroller.current;
    if (node !== null) node.scrollTop = node.scrollHeight;
  }, [events.length]);

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
        <span className="text-xs text-muted">Events</span>
        <span className="font-mono text-xs text-dim tabular-nums">{events.length}</span>
        <span className="flex-1" />
        <button
          type="button"
          className={HEAD_BUTTON}
          disabled={events.length === 0}
          title={events.length === 0 ? "The log is empty." : "Clear the log"}
          onClick={clearEvents}
        >
          Clear
        </button>
      </div>
      <div ref={scroller} className={SCROLL} role="log" aria-label="Events">
        {events.length === 0 ? (
          <div className="pointer-events-none" aria-hidden>
            {WIDTHS.map((width) => (
              <div key={width} className="flex min-h-4 items-center py-px">
                <span className={cn(SHIMMER, "h-2")} style={{ width }} />
              </div>
            ))}
          </div>
        ) : (
          events.map((row) => <EventRow key={row.id} row={row} />)
        )}
      </div>
    </motion.div>
  );
}
