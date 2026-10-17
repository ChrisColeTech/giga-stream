import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { CollectionsWindow } from "./CollectionsWindow";
import { SettingsWindow } from "./SettingsWindow";
import { TitleInfoWindow } from "./TitleInfoWindow";

/** THE ONE OPEN FLOW (`04` section 1): opening a flow replaces the open one. Every flow is a modal work window drawn
 *  inside the main window (`02` section 5). The AnimatePresence lives here so a window's exit can play after it is
 *  removed. */
export function OverlayHost() {
  const overlay = useAppStore((state) => state.overlay);

  return (
    <AnimatePresence>
      {overlay === "settings" && <SettingsWindow key="settings" />}
      {overlay === "collections" && <CollectionsWindow key="collections" />}
      {overlay === "title-info" && <TitleInfoWindow key="title-info" />}
    </AnimatePresence>
  );
}
