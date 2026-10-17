import { useEffect } from "react";
import { AppShell as ShellFrame } from "@giga/ui/shell/AppShell";
import { ContextMenu } from "@giga/ui/menus/ContextMenu";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { useContextMenu } from "@/hooks/useContextMenu";
import { LibraryPage } from "@/pages/LibraryPage";
import { LivePage } from "@/pages/LivePage";
import { PlayerPage } from "@/pages/PlayerPage";
import { useAppStore } from "@/store/app-store";
import { useSurface } from "@/store/selectors";
import { EventsDrawer } from "./EventsDrawer";
import { Statusbar } from "./Statusbar";
import { Titlebar } from "./Titlebar";

/** The interface's shell: the shared frame with the three pages, the events drawer, the overlay host and the one context
 *  menu, so two menus can never be open at once. The page for the active surface is the only one that shows. */
export function AppShell() {
  const surface = useSurface();
  const uiZoom = useAppStore((state) => state.uiZoom);
  const { menu, close } = useContextMenu();

  /* UI zoom applies to the whole interface: the document's own zoom, so every part of the window scales together. */
  useEffect(() => {
    document.documentElement.style.zoom = String(uiZoom);
  }, [uiZoom]);

  return (
    <ShellFrame
      titlebar={<Titlebar />}
      drawer={<EventsDrawer />}
      statusbar={<Statusbar />}
      overlay={<OverlayHost />}
      menu={menu !== null ? <ContextMenu anchor={menu.anchor} items={menu.items} onClose={close} /> : null}
    >
      <LivePage active={surface === "live"} />
      <LibraryPage active={surface === "library"} />
      <PlayerPage active={surface === "player"} />
    </ShellFrame>
  );
}
