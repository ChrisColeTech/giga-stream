import { MonitorPlay, PanelBottom, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SURFACES } from "@/constants/surfaces";
import { barTone } from "@/lib/bar-tone";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/app-store";
import { usePaneOpen, useSurface, useWorkSurfaceOpen } from "@/store/selectors";
import type { PaneSide } from "@/types/shell";
import { Brand } from "./Brand";
import { PageTabs } from "./PageTabs";

/* left-toggle · brand · centred nav · spacer · Theatre · bottom-toggle · right-toggle (Giga Cut's Export
 * slot, owner 2026-10-17). No window controls: those are the OS's own. The right padding reserves Win11's
 * caption-button strip: `env(titlebar-area-width)` is the width the PAGE may use, so the difference from
 * 100% is the strip. In a plain browser the variable is unset, the fallback makes the difference 0, and
 * the bar just keeps its 8px. Theatre mode paints the bar black. */
const TITLEBAR =
  "relative z-20 flex h-10 flex-none items-center gap-2 border-b pl-2 " +
  "pr-[calc(100%-env(titlebar-area-width,100%)+8px)] [-webkit-app-region:drag] " +
  "[&_button]:[-webkit-app-region:no-drag] " +
  "transition-[background-color,border-color] duration-fast ease-linear";

const TOGGLES: Readonly<Record<PaneSide, { label: string; Icon: typeof PanelLeft }>> = {
  left: { label: "left pane", Icon: PanelLeft },
  bottom: { label: "bottom pane", Icon: PanelBottom },
  right: { label: "right pane", Icon: PanelRight },
};

/* A disabled button takes no pointer events (the shared IconButton), so its reason hangs on the wrapper, which does. */
const SLEEPING_REASON = "Close the open window to change the panes.";

export function Titlebar() {
  const surface = useSurface();
  const togglePane = useAppStore((state) => state.togglePane);
  /* A MODAL CHILD WINDOW PUTS THE PANE CONTROLS TO SLEEP: the surface underneath stays intact, so without this the
   * toggles stayed live and pressing one rearranged a workspace nobody could see. A popup covers nothing and leaves
   * them awake. */
  const settingsOpen = useWorkSurfaceOpen();
  const theatre = useAppStore((state) => state.theatre);
  const toggleTheatre = useAppStore((state) => state.toggleTheatre);
  const open: Record<PaneSide, boolean> = {
    left: usePaneOpen(surface, "left"),
    right: usePaneOpen(surface, "right"),
    bottom: usePaneOpen(surface, "bottom"),
  };

  const toggle = (side: PaneSide) => {
    const { label, Icon } = TOGGLES[side];
    /* A surface without this pane keeps the control, disabled, never hidden, so the chrome does not shuffle from page
       to page. */
    const supported = SURFACES[surface].panes[side] !== null;
    const lit = supported && open[side] && !settingsOpen;
    const reason = supported ? (settingsOpen ? SLEEPING_REASON : undefined) : `${SURFACES[surface].label} has no ${label}.`;
    return (
      <span className="inline-flex" title={reason}>
        {/* Ghost, like Giga Cut's pane toggles (owner, 2026-10-17): transparent at rest, hover fill,
            accent tint while the pane is shown. `bordered` is for standalone icon actions elsewhere. */}
        <IconButton
          title={reason ?? `Toggle ${label}`}
          aria-label={`Toggle ${label}`}
          aria-pressed={lit}
          on={lit}
          disabled={reason !== undefined}
          onClick={() => togglePane(side)}
        >
          <Icon className="size-3.75" />
        </IconButton>
      </span>
    );
  };

  return (
    <header className={cn("chrome-bar", TITLEBAR, barTone(theatre))}>
      {toggle("left")}
      <Brand />
      {/* Absolutely centred on the TITLEBAR, not flex-centred among siblings, so showing or disabling a pane toggle
          never shifts the nav. */}
      <div className="flex-1">
        <PageTabs surface={surface} disabled={settingsOpen} />
      </div>
      {/* Giga Cut's Export slot: beside the pane toggles, owner 2026-10-17. Ghost, as every titlebar button. */}
      <Button
        size="sm"
        variant="ghost"
        title={theatre ? "Theatre mode is on. Press to leave it; reopen panes with their toggles." : "Theatre mode"}
        aria-label="Theatre mode"
        aria-pressed={theatre}
        on={theatre}
        onClick={toggleTheatre}
      >
        <MonitorPlay aria-hidden /> Theatre
      </Button>
      {toggle("bottom")}
      {toggle("right")}
    </header>
  );
}
