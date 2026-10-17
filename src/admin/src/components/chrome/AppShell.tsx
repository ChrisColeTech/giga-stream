import { useEffect } from "react";
import { Tv } from "lucide-react";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { ContextMenu } from "@giga/ui/menus/ContextMenu";
import { AppShell as ShellFrame } from "@giga/ui/shell/AppShell";
import { Brand } from "@giga/ui/shell/Brand";
import { RunningWork } from "@giga/ui/shell/RunningWork";
import { Statusbar } from "@giga/ui/shell/Statusbar";
import type { PaneToggleProps } from "@giga/ui/shell/PaneToggle";
import { Titlebar } from "@giga/ui/shell/Titlebar";
import { SURFACES, SURFACE_ORDER } from "@/constants/surfaces";
import { JOBS } from "@/fixtures/jobs";
import { useContextMenu } from "@/hooks/useContextMenu";
import { LibraryPage } from "@/pages/LibraryPage";
import { LivePage } from "@/pages/LivePage";
import { PlayerPage } from "@/pages/PlayerPage";
import { cancelJob } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import { usePaneOpen, useSurface, useWorkSurfaceOpen } from "@/store/selectors";
import { isLive } from "@/types/job";
import type { PaneSide } from "@/types/shell";
import { EventsDrawer } from "@giga/ui/shell/EventsDrawer";

const TABS = SURFACE_ORDER.map((id) => ({ id, label: SURFACES[id].label }));

const SIDE_LABEL: Readonly<Record<PaneSide, string>> = { left: "left pane", bottom: "bottom pane", right: "right pane" };

/* A MODAL CHILD WINDOW PUTS THE NAV AND THE PANE CONTROLS TO SLEEP. A popup covers nothing. */
const SLEEPING_TABS = "Close the open window to switch surfaces.";
const SLEEPING_REASON = "Close the open window to change the panes.";

/** The demo shell, composed from the shared library's frame, bars and pieces (docs/27 step 4). Its running work reads the
 *  jobs fixture; Wave 2 replaces the demo with the admin's own content. */
export function AppShell() {
  const surface = useSurface();
  const uiZoom = useAppStore((state) => state.uiZoom);
  const togglePane = useAppStore((state) => state.togglePane);
  const setSurface = useAppStore((state) => state.setSurface);
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const events = useAppStore((state) => state.events);
  const clearEvents = useAppStore((state) => state.clearEvents);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const notice = useAppStore((state) => state.notice);
  const say = useAppStore((state) => state.say);
  const settingsOpen = useWorkSurfaceOpen();
  const { menu, close } = useContextMenu();
  const open: Record<PaneSide, boolean> = {
    left: usePaneOpen(surface, "left"),
    right: usePaneOpen(surface, "right"),
    bottom: usePaneOpen(surface, "bottom"),
  };

  /* UI zoom applies to the whole interface: the document's own zoom, so every part of the window scales together. */
  useEffect(() => {
    document.documentElement.style.zoom = String(uiZoom);
  }, [uiZoom]);

  const toggle = (side: PaneSide): PaneToggleProps => {
    /* A surface without this pane keeps the control, disabled, never hidden. */
    const supported = SURFACES[surface].panes[side] !== null;
    const lit = supported && open[side] && !settingsOpen;
    const reason = supported ? (settingsOpen ? SLEEPING_REASON : undefined) : `${SURFACES[surface].label} has no ${SIDE_LABEL[side]}.`;
    return { side, lit, reason, onToggle: () => togglePane(side) };
  };

  const live = JOBS.filter(isLive);
  const running = live[0] ?? null;
  const percent = running?.percent === undefined ? null : Math.max(0, Math.min(100, running.percent));
  const stop = () => {
    if (running === null) return;
    const result = cancelJob(running.id);
    if (!result.ok) say(result.message, "warn");
  };

  return (
    <ShellFrame
      titlebar={
        <Titlebar
          brand={<Brand word="GIGA" subtitle="STREAM" icon={Tv} />}
          tabs={{ label: "Surfaces", items: TABS, active: surface, disabled: settingsOpen, disabledReason: SLEEPING_TABS, onSelect: setSurface }}
          left={toggle("left")}
          bottom={toggle("bottom")}
          right={toggle("right")}
        />
      }
      drawer={<EventsDrawer open={eventsOpen} rows={events} onClear={clearEvents} />}
      statusbar={
        <Statusbar
          running={<RunningWork running={running === null ? null : { label: running.label, percent }} liveCount={live.length} onStop={stop} />}
          notice={notice}
          events={{ open: eventsOpen, onToggle: toggleEvents }}
          onSettings={() => openOverlay("settings")}
        />
      }
      overlay={<OverlayHost />}
      menu={menu !== null ? <ContextMenu anchor={menu.anchor} items={menu.items} onClose={close} /> : null}
    >
      <LivePage active={surface === "live"} />
      <LibraryPage active={surface === "library"} />
      <PlayerPage active={surface === "player"} />
    </ShellFrame>
  );
}
