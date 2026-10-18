import { MonitorPlay, Tv } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Brand } from "@giga/ui/shell/Brand";
import { Titlebar as TitlebarBar } from "@giga/ui/shell/Titlebar";
import type { PaneToggleProps } from "@giga/ui/shell/PaneToggle";
import { SURFACES, SURFACE_ORDER } from "@/constants/surfaces";
import { barTone } from "@/lib/bar-tone";
import { useAppStore } from "@/store/app-store";
import { usePaneOpen, useSurface, useWorkSurfaceOpen } from "@/store/selectors";
import type { PaneSide } from "@/types/shell";

const TABS = SURFACE_ORDER.map((id) => ({ id, label: SURFACES[id].label }));

const SIDE_LABEL: Readonly<Record<PaneSide, string>> = { left: "left pane", bottom: "bottom pane", right: "right pane" };

/* A MODAL CHILD WINDOW PUTS THE NAV AND THE PANE CONTROLS TO SLEEP: the surface underneath stays intact, so without this
 * the toggles stayed live and pressing one rearranged a workspace nobody could see. A popup covers nothing. */
const SLEEPING_TABS = "Close the open window to switch surfaces.";
const SLEEPING_REASON = "Close the open window to change the panes.";

/** The interface's titlebar: the store decides what each control says and does; the shared bar draws it. */
export function Titlebar() {
  const surface = useSurface();
  const setSurface = useAppStore((state) => state.setSurface);
  const togglePane = useAppStore((state) => state.togglePane);
  const settingsOpen = useWorkSurfaceOpen();
  const theatre = useAppStore((state) => state.theatre);
  const toggleTheatre = useAppStore((state) => state.toggleTheatre);
  const open: Record<PaneSide, boolean> = {
    left: usePaneOpen(surface, "left"),
    right: usePaneOpen(surface, "right"),
    bottom: usePaneOpen(surface, "bottom"),
  };

  const toggle = (side: PaneSide): PaneToggleProps => {
    /* A surface without this pane keeps the control, disabled, never hidden, so the chrome does not shuffle from page to
       page. */
    const supported = SURFACES[surface].panes[side] !== null;
    const lit = supported && open[side] && !settingsOpen;
    const reason = supported ? (settingsOpen ? SLEEPING_REASON : undefined) : `${SURFACES[surface].label} has no ${SIDE_LABEL[side]}.`;
    return { side, lit, reason, onToggle: () => togglePane(side) };
  };

  /* Ghost, like Giga Cut's titlebar (owner, 2026-10-17). Giga Cut's Export slot, beside the pane toggles. Asleep
   * under an open window like every other titlebar control (`50` section 2.5): disabled with the tabs' sleeping
   * wording, and reading unselected whatever Theatre is doing behind the window. */
  const asleep = settingsOpen;
  const theatreButton = (
    <Button
      size="sm"
      variant="ghost"
      disabled={asleep}
      title={asleep
        ? SLEEPING_TABS
        : theatre ? "Theatre mode is on. Press to leave it; reopen panes with their toggles." : "Theatre mode"}
      aria-label="Theatre mode"
      aria-pressed={theatre && !asleep}
      on={theatre && !asleep}
      onClick={toggleTheatre}
    >
      <MonitorPlay aria-hidden /> Theatre
    </Button>
  );

  return (
    <TitlebarBar
      tone={barTone(theatre)}
      brand={<Brand word="GIGA" subtitle="STREAM" icon={Tv} />}
      tabs={{ label: "Surfaces", items: TABS, active: surface, disabled: settingsOpen, disabledReason: SLEEPING_TABS, onSelect: setSurface }}
      left={toggle("left")}
      bottom={toggle("bottom")}
      right={toggle("right")}
      trailing={theatreButton}
    />
  );
}
