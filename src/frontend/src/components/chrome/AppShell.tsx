import { useEffect } from "react";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { useContextMenu } from "@/hooks/useContextMenu";
import { LibraryPage } from "@/pages/LibraryPage";
import { LivePage } from "@/pages/LivePage";
import { PlayerPage } from "@/pages/PlayerPage";
import { useAppStore } from "@/store/app-store";
import { useSurface } from "@/store/selectors";
import { EventsDrawer } from "./EventsDrawer";
import { Statusbar } from "./Statusbar";
import { Titlebar } from "./Titlebar";

/* A flat flex column: titlebar, one page per surface (only the active one shows), the events drawer, the statusbar.
 * The shell renders once: pages do not remount the chrome around them. The one open flow (a work frame or a popup) is
 * drawn by the overlay host, a sibling of the frame rather than a child. The one context menu is owned here too, so two
 * can never be open at once (the family's AppShell). */
export function AppShell() {
  const surface = useSurface();
  const uiZoom = useAppStore((state) => state.uiZoom);
  const theatre = useAppStore((state) => state.theatre);
  const { menu, close } = useContextMenu();

  /* UI zoom applies to the whole interface: the document's own zoom, so every part of the window scales together. */
  useEffect(() => {
    document.documentElement.style.zoom = String(uiZoom);
  }, [uiZoom]);

  /* Theatre's black is a root token remap (index.css), so the attribute rides on <html> and every surface,
   * input and border follows at once. */
  useEffect(() => {
    if (theatre) document.documentElement.dataset.theatre = "";
    else delete document.documentElement.dataset.theatre;
  }, [theatre]);

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
      {menu !== null && <ContextMenu anchor={menu.anchor} items={menu.items} onClose={close} />}
    </>
  );
}
