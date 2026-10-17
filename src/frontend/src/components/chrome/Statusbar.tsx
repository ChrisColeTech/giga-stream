import { CircleAlert, PanelBottom, Settings } from "lucide-react";
import { barTone } from "@/lib/bar-tone";
import { cn } from "@giga/ui/lib/cn";
import { useAppStore } from "@/store/app-store";
import { RunningWork } from "./RunningWork";

/* The status bar is for state: the running work (LoRA's progress bar and Stop), the ONE notice line (an outcome or a
 * refusal, as a sentence), then the two doors on the right, Events and Settings. Events is a toggle: the button that opens
 * the drawer closes it, and wears the pressed look while it is up. Settings only opens its modal window. */
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

/* The sentence is always the readable text color; the tone is the glyph's color beside it, so a warn stays legible on
   the light theme and color is never the only signal. */
const GLYPH = { warn: "text-st-loading", error: "text-st-failed" } as const;

export function Statusbar() {
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const notice = useAppStore((state) => state.notice);
  const theatre = useAppStore((state) => state.theatre);

  return (
    <footer className={cn("chrome-bar", BAR, barTone(theatre))}>
      <RunningWork />
      {notice !== null && (
        <span key={notice.serial} role="status" title={notice.sentence} className="flex min-w-0 items-center gap-1.5 text-xs text-text">
          {notice.tone !== "info" && <CircleAlert className={cn("size-3 flex-none", GLYPH[notice.tone])} aria-hidden />}
          <span className="truncate">{notice.sentence}</span>
        </span>
      )}
      <span className="flex-1" />
      <button
        type="button"
        aria-pressed={eventsOpen}
        data-on={eventsOpen ? "" : undefined}
        className={BUTTON}
        onClick={toggleEvents}
      >
        <PanelBottom className="size-3.5" aria-hidden /> Events
      </button>
      {/* Settings is a modal window whose scrim covers this bar, so the door is never lit as a toggle: the window's own
          X and Escape close it. */}
      <button
        type="button"
        className={BUTTON}
        onClick={() => openOverlay("settings")}
      >
        <Settings className="size-3.5" aria-hidden /> Settings
      </button>
    </footer>
  );
}
