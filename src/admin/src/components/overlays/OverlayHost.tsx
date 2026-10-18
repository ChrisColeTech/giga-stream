import { AnimatePresence } from "framer-motion";
import { ChildMemoryContext, type ChildMemory } from "@giga/ui/lib/child-memory";
import { PreviewWindow } from "@/components/channels/PreviewWindow";
import { useAppStore } from "@/store/app-store";
import { SettingsWindow } from "./SettingsWindow";

/** Where the windows were last, kept in the store for the run: a window reads it as it opens and writes it at the end
 *  of a drag or a resize. `29` (Wave 7) saves it per account. */
const MEMORY: ChildMemory = {
  recall: (key) => useAppStore.getState().childBounds[key],
  remember: (key, box) => useAppStore.getState().rememberChild(key, box),
};

/** THE ONE OPEN FLOW (`04` section 1): opening a flow replaces the open one. Every flow is a modal work window drawn
 *  inside the main window (`02` section 5): Settings, and the Preview of one saved channel (`36` section 8). Replacing the
 *  Preview unmounts it, which destroys its player. The AnimatePresence lives here so a window's exit can play after it
 *  is removed. */
export function OverlayHost() {
  const overlay = useAppStore((state) => state.overlay);

  return (
    <ChildMemoryContext value={MEMORY}>
      <AnimatePresence>
        {overlay === "settings" && <SettingsWindow key="settings" />}
        {overlay === "preview" && <PreviewWindow key="preview" />}
      </AnimatePresence>
    </ChildMemoryContext>
  );
}
