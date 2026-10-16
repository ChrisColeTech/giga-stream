import { OverlayHost } from "@/components/overlays/OverlayHost";
import { LibraryPage } from "@/pages/LibraryPage";
import { LivePage } from "@/pages/LivePage";
import { PlayerPage } from "@/pages/PlayerPage";
import { useSurface } from "@/store/selectors";
import { EventsDrawer } from "./EventsDrawer";
import { Statusbar } from "./Statusbar";
import { Titlebar } from "./Titlebar";

/* A flat flex column: titlebar, one page per surface (only the active one shows), the events drawer, the statusbar.
 * The shell renders once: pages do not remount the chrome around them. The one open flow (a work frame or a popup) is
 * drawn by the overlay host, a sibling of the frame rather than a child. */
export function AppShell() {
  const surface = useSurface();

  return (
    <>
      <div className="flex h-full flex-col">
        <Titlebar />
        <LivePage active={surface === "live"} />
        <LibraryPage active={surface === "library"} />
        <PlayerPage active={surface === "player"} />
        <EventsDrawer />
        <Statusbar />
      </div>
      <OverlayHost />
    </>
  );
}
