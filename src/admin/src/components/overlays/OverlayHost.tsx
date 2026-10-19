import { AnimatePresence } from "framer-motion";
import { ChildMemoryContext, type ChildMemory } from "@giga/ui/lib/child-memory";
import { PreviewWindow } from "@/components/channels/PreviewWindow";
import { ProviderPreviewWindow } from "@/components/providers/ProviderPreviewWindow";
import { TitlePreviewWindow } from "@/components/titles/TitlePreviewWindow";
import { useAppStore } from "@/store/app-store";
import { SettingsWindow } from "./SettingsWindow";

/** Where the windows were last, kept in the store for the run: a window reads it as it opens and writes it at the end
 *  of a drag or a resize. `29` (Wave 7) saves it per account. */
const MEMORY: ChildMemory = {
  recall: (key) => useAppStore.getState().childBounds[key],
  remember: (key, box) => useAppStore.getState().rememberChild(key, box),
  maximized: (key) => useAppStore.getState().childMaximized[key] === true,
  setMaximized: (key, on) => useAppStore.getState().rememberMaximized(key, on),
};

/** THE ONE OPEN FLOW (`04` section 1): opening a flow replaces the open one. Every flow is a modal work window drawn
 *  inside the main window (`02` section 5): Settings, the Preview of one saved channel (`36` section 8), and the previews
 *  of one provider and of one title (`55` decisions 7 and 8). Replacing a preview unmounts it, which blanks its frame and
 *  clears its player policy. The AnimatePresence lives here so a window's exit can play after it is removed. */
export function OverlayHost() {
  const overlay = useAppStore((state) => state.overlay);

  return (
    <ChildMemoryContext value={MEMORY}>
      <AnimatePresence>
        {overlay === "settings" && <SettingsWindow key="settings" />}
        {overlay === "preview" && <PreviewWindow key="preview" />}
        {overlay === "provider-preview" && <ProviderPreviewWindow key="provider-preview" />}
        {overlay === "title-preview" && <TitlePreviewWindow key="title-preview" />}
      </AnimatePresence>
    </ChildMemoryContext>
  );
}
