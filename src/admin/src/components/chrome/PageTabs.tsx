import { SURFACES, SURFACE_ORDER } from "@/constants/surfaces";
import { useAppStore } from "@/store/app-store";
import type { Surface } from "@/types/shell";

export interface PageTabsProps {
  surface: Surface;
  /** True while an overlay covers the pages: a control whose effect would land somewhere invisible goes disabled AND
   *  de-lit, and the pressed look comes back where it was when the overlay lifts. */
  disabled?: boolean;
}

/* THE APP'S NAV: a RECESSED TRACK HOLDING RAISED CHIPS, the same control vocabulary as Segmented, Button and
 * IconButton. An equal-width grid, not a flex row: flex sizes each tab to its label, so `Live` came out narrower
 * than `Library` beside it and the nav read as ragged chips. Every tab is the width of the longest. */
const NAV =
  "absolute top-1/2 left-1/2 inline-grid -translate-x-1/2 -translate-y-1/2 auto-cols-fr grid-flow-col gap-0.5 " +
  "rounded-[9px] border border-ctl-edge bg-surface p-0.5 font-sans text-xs [-webkit-app-region:no-drag]";

const TAB =
  /* Sentence case, no transform. */
  "cursor-pointer rounded-[6px] border-0 bg-transparent px-3.25 py-1 text-center text-muted " +
  "transition-[background,color,box-shadow] duration-fade ease-linear " +
  "not-disabled:hover:text-text not-data-active:not-disabled:active:bg-hov " +
  /* Chrome asleep under an overlay should simply be inert: not a forbidding cursor. */
  "disabled:pointer-events-none disabled:cursor-default disabled:opacity-45 " +
  "data-active:bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] " +
  "data-active:font-semibold data-active:text-accent-text " +
  "data-active:shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)]";

/* Disabled tabs take no pointer events, so the reason hangs on the track, which is what the pointer lands on. */
const SLEEPING_REASON = "Close the open window to switch surfaces.";

export function PageTabs({ surface, disabled = false }: PageTabsProps) {
  const setSurface = useAppStore((state) => state.setSurface);

  return (
    <nav className={NAV} aria-label="Surfaces" title={disabled ? SLEEPING_REASON : undefined}>
      {SURFACE_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={TAB}
          disabled={disabled}
          data-active={!disabled && id === surface ? "" : undefined}
          onClick={() => setSurface(id)}
        >
          {SURFACES[id].label}
        </button>
      ))}
    </nav>
  );
}
