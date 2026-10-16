import { PanelBottom, PanelLeft, PanelRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { SURFACES } from "@/constants/surfaces";
import { useAppStore } from "@/store/app-store";
import { usePaneOpen, useSurface, useWorkSurfaceOpen } from "@/store/selectors";
import type { PaneSide } from "@/types/shell";
import { Brand } from "./Brand";
import { PageTabs } from "./PageTabs";

/* left-toggle · brand · centred nav · spacer · bottom-toggle · right-toggle. No window controls: those are the OS's
 * own. The right padding reserves Win11's caption-button strip: `env(titlebar-area-width)` is the width the PAGE may
 * use, so the difference from 100% is the strip. In a plain browser the variable is unset, the fallback makes the
 * difference 0, and the bar just keeps its 8px. */
const TITLEBAR =
  "relative z-20 flex h-10 flex-none items-center gap-2 border-b border-border bg-panel pl-2 " +
  "pr-[calc(100%-env(titlebar-area-width,100%)+8px)] [-webkit-app-region:drag] " +
  "[&_button]:[-webkit-app-region:no-drag]";

const TOGGLES: Array<{ side: PaneSide; label: string; Icon: typeof PanelLeft }> = [
  { side: "left", label: "left pane", Icon: PanelLeft },
  { side: "bottom", label: "bottom pane", Icon: PanelBottom },
  { side: "right", label: "right pane", Icon: PanelRight },
];

export function Titlebar() {
  const surface = useSurface();
  const togglePane = useAppStore((state) => state.togglePane);
  /* A MODAL CHILD WINDOW PUTS THE PANE CONTROLS TO SLEEP: the surface underneath stays intact, so without this the
   * toggles stayed live and pressing one rearranged a workspace nobody could see. A popup covers nothing and leaves
   * them awake. */
  const settingsOpen = useWorkSurfaceOpen();
  const open: Record<PaneSide, boolean> = {
    left: usePaneOpen(surface, "left"),
    right: usePaneOpen(surface, "right"),
    bottom: usePaneOpen(surface, "bottom"),
  };

  const toggle = (side: PaneSide) => {
    const { label, Icon } = TOGGLES.find((entry) => entry.side === side)!;
    /* A surface without this pane keeps the control, disabled, never hidden, so the chrome does not shuffle from page
       to page. */
    const supported = SURFACES[surface].panes[side] !== null;
    const lit = supported && open[side] && !settingsOpen;
    return (
      <IconButton
        title={`Toggle ${label}`}
        aria-label={`Toggle ${label}`}
        aria-pressed={lit}
        on={lit}
        disabled={!supported || settingsOpen}
        onClick={() => togglePane(side)}
      >
        <Icon className="size-3.75" />
      </IconButton>
    );
  };

  return (
    <header className={TITLEBAR}>
      {toggle("left")}
      <Brand />
      {/* Absolutely centred on the TITLEBAR, not flex-centred among siblings, so showing or disabling a pane toggle
          never shifts the nav. */}
      <div className="flex-1">
        <PageTabs surface={surface} disabled={settingsOpen} />
      </div>
      {toggle("bottom")}
      {toggle("right")}
    </header>
  );
}
