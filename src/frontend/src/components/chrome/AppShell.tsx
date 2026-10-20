import { AppShell as ShellFrame } from "@giga/ui/shell/AppShell";
import { ContextMenu } from "@giga/ui/menus/ContextMenu";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useDesktopRenderer } from "@/hooks/useDesktopRenderer";
import { useUiZoom } from "@/hooks/useUiZoom";
import { LibraryPage } from "@/pages/LibraryPage";
import { LivePage } from "@/pages/LivePage";
import { PlayerPage } from "@/pages/PlayerPage";
import { useSurface } from "@/store/selectors";
import { EventsDrawer } from "./EventsDrawer";
import { Statusbar } from "./Statusbar";
import { Titlebar } from "./Titlebar";

/** The interface's shell: the shared frame with the three pages, the events drawer, the overlay host and the one context
 *  menu, so two menus can never be open at once. The page for the active surface is the only one that shows. */
export function AppShell() {
  const surface = useSurface();
  const desktop = useDesktopRenderer();
  const { menu, close } = useContextMenu();
  useUiZoom();

  return (
    <ShellFrame
      titlebar={<Titlebar />}
      drawer={<EventsDrawer />}
      statusbar={desktop ? <Statusbar /> : null}
      overlay={<OverlayHost />}
      menu={menu !== null ? <ContextMenu anchor={menu.anchor} items={menu.items} onClose={close} /> : null}
    >
      <LivePage active={surface === "live"} />
      <LibraryPage active={surface === "library"} />
      <PlayerPage active={surface === "player"} />
    </ShellFrame>
  );
}
