import { PanelBottom, Settings } from "lucide-react";
import { CONNECTION_DOT, PREVIEW_CONNECTION } from "@/fixtures/connection";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/app-store";

/* The status bar is for state: the connection dot and its word, the ONE notice line (an outcome or a refusal, as a
 * sentence), then the two doors on the right, Events and Settings. Each door is a toggle: the button that opened a
 * panel is the button that closes it, and it wears the same pressed look while its panel is up. */
const BAR =
  "relative z-20 flex h-6 flex-none items-center gap-2.5 border-t border-border " +
  "bg-panel px-2.5 font-sans text-xs text-faint";

const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.25 rounded-ctl border-0 bg-transparent px-1.5 py-0.5 " +
  "font-sans text-xs text-faint transition-[background-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-muted active:bg-hov active:text-faint " +
  /* A variant, so the open state beats the base `text-faint`. */
  "data-on:bg-accent-tint data-on:text-accent-text";

const TONE = { info: "text-muted", warn: "text-st-loading", error: "text-st-failed" } as const;

export function Statusbar() {
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const settingsOpen = useAppStore((state) => state.overlay === "settings");
  const openOverlay = useAppStore((state) => state.openOverlay);
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const notice = useAppStore((state) => state.notice);

  return (
    <footer className={BAR}>
      {/* THE DOT IS THE WORD: the sentence survives in the tooltip for the case that matters, the dot going grey. */}
      <span className="inline-flex items-center gap-1.5" title="The fileserver connection.">
        <StatusDot state={CONNECTION_DOT[PREVIEW_CONNECTION]} />
        <span className="font-mono tabular-nums">{PREVIEW_CONNECTION}</span>
      </span>
      {notice !== null && (
        <span
          key={notice.serial}
          role="status"
          title={notice.sentence}
          className={cn("min-w-0 truncate", TONE[notice.tone])}
        >
          {notice.sentence}
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
        <PanelBottom className="size-2.75" aria-hidden /> Events
      </button>
      <button
        type="button"
        aria-pressed={settingsOpen}
        data-on={settingsOpen ? "" : undefined}
        className={BUTTON}
        onClick={() => (settingsOpen ? closeOverlay() : openOverlay("settings"))}
      >
        <Settings className="size-2.75" aria-hidden /> Settings
      </button>
    </footer>
  );
}
