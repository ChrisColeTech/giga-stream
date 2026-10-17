import { AnimatePresence } from "framer-motion";
import { ChildMemoryContext } from "@giga/ui/lib/child-memory";
import type { ChildMemory } from "@giga/ui/lib/child-memory";
import { useAppStore } from "@/store/app-store";
import { CollectionsWindow } from "./CollectionsWindow";
import { SettingsWindow } from "./SettingsWindow";
import { TitleInfoWindow } from "./TitleInfoWindow";

/** Where the windows were last, kept in the store for the run: a window reads it as it opens and writes it at the end
 *  of a drag or a resize. */
const MEMORY: ChildMemory = {
  recall: (key) => useAppStore.getState().childBounds[key],
  remember: (key, box) => useAppStore.getState().rememberChild(key, box),
};

/** THE ONE OPEN FLOW (`04` section 1): opening a flow replaces the open one. Every flow is a modal work window drawn
 *  inside the main window (`02` section 5). The AnimatePresence lives here so a window's exit can play after it is
 *  removed. */
export function OverlayHost() {
  const overlay = useAppStore((state) => state.overlay);

  return (
    <ChildMemoryContext value={MEMORY}>
      <AnimatePresence>
        {overlay === "settings" && <SettingsWindow key="settings" />}
        {overlay === "collections" && <CollectionsWindow key="collections" />}
        {overlay === "title-info" && <TitleInfoWindow key="title-info" />}
      </AnimatePresence>
    </ChildMemoryContext>
  );
}
