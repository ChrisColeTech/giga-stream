import { Maximize2, Minimize2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useContext, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "../controls/IconButton";
import { useChildWindowBox } from "../hooks/useChildWindowBox";
import { useChildWindowKeys } from "../hooks/useChildWindowKeys";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { BORDER, HEADER_GAP, INSET, TITLE_HEIGHT } from "../lib/child-metrics";
import { ChildMemoryContext } from "../lib/child-memory";
import type { ChildSpec } from "../lib/child-types";
import { EASE_OUT } from "../lib/motion-timing";
import { ChildGrips } from "./ChildGrips";
import { ChildScrim } from "./ChildScrim";
import { ChildStatusbar, type ChildStatus } from "./ChildStatusbar";

export interface ChildWindowProps {
  readonly spec: ChildSpec;
  /** Dismissal: the header's X, Escape by the spec's policy. It discards a Draft and commits nothing. */
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** The header's content in place of `spec.title`, for a window whose title is its subject (a channel's name); a
   *  shimmer while that is read. Absent, the header shows `spec.title`. The remembered bounds stay keyed by `spec.key`. */
  readonly heading?: ReactNode;
  /** The name the window answers to (its `aria-label` and the close button's) when `heading` is not plain text. */
  readonly label?: string;
  /** A status bar at the window's foot (`36` section 8.3): state only, words and counts. Absent, nothing is drawn. */
  readonly status?: ChildStatus;
}

/* THE AUTHORED CHILD WINDOW, drawn inside the main window (the family's in-app stand-in for a second OS window; the
 * Rust app draws the same thing where no second window can be made). No native chrome: its own 1px border, the shared
 * title header with the close X named `Close <title>`, a drag area over the header (minus the X), eight grips, and a body
 * laid out to the window's actual size, not to a size class. It opens centred (or by the corner for a tool) at the size
 * its content wants but never more than 80% of the main window, can be made as large as the main window and no smaller
 * than its least, stays inside the main window, and remembers its size and place for the run. A modal one puts a scrim
 * over the main window and makes it deaf. Closing is dismissal, never a commit. Its entrance and exit are one
 * framer-motion fade-and-rise; the host holds the AnimatePresence. */
export function ChildWindow({ spec, onClose, children, heading, label = spec.title, status }: ChildWindowProps) {
  const frame = useRef<HTMLDivElement | null>(null);
  const { box, move, grip, maximized, toggleMaximized } = useChildWindowBox(spec, useContext(ChildMemoryContext));
  const maximizable = spec.maximizable !== false;
  const MaxIcon = maximized ? Minimize2 : Maximize2;
  const maxLabel = `${maximized ? "Restore" : "Maximize"} ${label}`;
  const reduced = useReduceMotion();
  useChildWindowKeys(frame, { escape: spec.escape, modal: spec.modal, onClose });

  return (
    <>
      {spec.modal && <ChildScrim onPress={() => frame.current?.focus({ preventScroll: true })} />}
      <motion.div
        ref={frame}
        role="dialog"
        aria-label={`${label} window`}
        aria-modal={spec.modal || undefined}
        tabIndex={-1}
        data-child-window={spec.key}
        className="fixed z-49 flex flex-col bg-panel font-sans shadow-menu outline-none"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          border: `${BORDER}px solid var(--color-border)`,
          padding: INSET,
        }}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: reduced ? 0 : 0.2, ease: EASE_OUT }}
      >
        {!maximized && <ChildGrips grip={grip} />}
        <div
          data-drag
          className="flex flex-none cursor-default touch-none items-center gap-2 border-b border-hair select-none"
          style={{ height: TITLE_HEIGHT, marginBottom: HEADER_GAP }}
          onDoubleClick={(event) => {
            if (maximizable && (event.target as HTMLElement).closest("button") === null) toggleMaximized();
          }}
          {...move}
        >
          <h2 className="m-0 min-w-0 flex-1 truncate pl-1 font-sans text-sm font-semibold text-text" title={heading === undefined ? undefined : label}>
            {heading ?? spec.title}
          </h2>
          {maximizable && (
            <IconButton bordered title={maxLabel} aria-label={maxLabel} onClick={toggleMaximized}>
              <MaxIcon className="size-3.5" aria-hidden />
            </IconButton>
          )}
          <IconButton bordered title={`Close ${label}`} aria-label={`Close ${label}`} onClick={onClose}>
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        {status !== undefined && <ChildStatusbar {...status} />}
      </motion.div>
    </>
  );
}
