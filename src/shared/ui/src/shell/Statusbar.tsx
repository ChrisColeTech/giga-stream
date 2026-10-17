import { CircleAlert, PanelBottom, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface StatusNotice {
  /** Changes with each notice, so the line mounts afresh and plays once. */
  readonly serial: number;
  readonly tone: "info" | "warn" | "error";
  readonly sentence: string;
}

export interface StatusbarProps {
  /** The running work: a progress bar and Stop (`RunningWork`). */
  readonly running: ReactNode;
  /** The ONE notice line, an outcome or a refusal as a sentence. */
  readonly notice: StatusNotice | null;
  /** The Events door: a toggle that wears the pressed look while the drawer is up. */
  readonly events: { readonly open: boolean; readonly onToggle: () => void };
  /** The Settings door. It only opens a modal window, so it is never lit. */
  readonly onSettings: () => void;
  readonly tone?: string;
}

/* The status bar is for state: the running work, the ONE notice line, then the two doors on the right. */
const BAR =
  "relative z-20 flex h-6 flex-none items-center gap-2.5 border-t px-2.5 font-sans text-xs text-muted " +
  "transition-[background-color,border-color] duration-fast ease-linear";

/* A door is a control label (12px, muted) with its icon in the same colour: both are muted at rest and both take the
 * accent only while the door's panel is up (`data-on`). The icon inherits the colour, so it cannot be lit alone. */
const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.25 rounded-ctl border-0 bg-transparent px-1.5 py-0.5 " +
  "font-sans text-xs text-muted transition-[background-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-text active:bg-hov " +
  /* A variant, so the open state beats the base `text-muted`. */
  "data-on:bg-accent-tint data-on:text-accent-text";

/* The sentence is always the readable text colour; the tone is the glyph's colour beside it, so a warn stays legible on
 * the light theme and colour is never the only signal. */
const GLYPH = { warn: "text-st-loading", error: "text-st-failed" } as const;

const NORMAL_TONE = "border-border bg-panel";

export function Statusbar({ running, notice, events, onSettings, tone = NORMAL_TONE }: StatusbarProps) {
  return (
    <footer className={cn("chrome-bar", BAR, tone)}>
      {running}
      {notice !== null && (
        <span key={notice.serial} role="status" title={notice.sentence} className="flex min-w-0 items-center gap-1.5 text-xs text-text">
          {notice.tone !== "info" && <CircleAlert className={cn("size-3 flex-none", GLYPH[notice.tone])} aria-hidden />}
          <span className="truncate">{notice.sentence}</span>
        </span>
      )}
      <span className="flex-1" />
      <button type="button" aria-pressed={events.open} data-on={events.open ? "" : undefined} className={BUTTON} onClick={events.onToggle}>
        <PanelBottom className="size-3.5" aria-hidden /> Events
      </button>
      <button type="button" className={BUTTON} onClick={onSettings}>
        <Settings className="size-3.5" aria-hidden /> Settings
      </button>
    </footer>
  );
}
