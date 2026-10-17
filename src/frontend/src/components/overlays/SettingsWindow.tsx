import { useState } from "react";
import { AboutSection } from "@/components/settings/AboutSection";
import { AdminBackendSection } from "@/components/settings/AdminBackendSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { PlaybackSection } from "@/components/settings/PlaybackSection";
import { SettingsRail } from "@/components/settings/SettingsRail";
import { workSpec } from "@/constants/child-window";
import type { SettingsSectionId } from "@/constants/settings-sections";
import { SETTINGS_VALUES } from "@/fixtures/settings";
import { useAppStore } from "@/store/app-store";
import { saveSetting } from "@/services/settings";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("settings", "Settings");

/** Settings: a Work child window. The header carries the title and the close X; the body is the rail and the workspace
 *  beside it. The admin backend address saves through the fileserver. The default view is held here, seeded from the
 *  fixture, so a section switch keeps it; it does not save yet. Theme, motion, accent, zoom and the playback preferences
 *  live in the store and apply at once. */
export function SettingsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const setSurface = useAppStore((state) => state.setSurface);
  const say = useAppStore((state) => state.say);
  const [section, setSection] = useState<SettingsSectionId>("appearance");
  const [libraryView, setLibraryView] = useState(SETTINGS_VALUES.libraryView);

  /* Phase 1: the library's History view belongs to the Library surface, so this only closes Settings and selects the
     library. */
  const openHistory = () => {
    closeOverlay();
    setSurface("library");
  };

  /* A refused save is reported once on the notice line; the section keeps the draft in its field. */
  const commitAddress = (address: string) => {
    const result = saveSetting("adminUrl", address);
    if (!result.ok) say(result.message, "warn");
  };

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
        <SettingsRail selected={section} onSelect={setSection} />
        <div role="tabpanel" aria-label={section} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {section === "appearance" && <AppearanceSection />}
            {section === "playback" && <PlaybackSection />}
            {section === "library" && (
              <LibrarySection
                libraryView={libraryView}
                onLibraryView={setLibraryView}
                onOpenCollections={() => openOverlay("collections")}
                onOpenHistory={openHistory}
              />
            )}
            {section === "admin" && <AdminBackendSection adminUrl={SETTINGS_VALUES.adminUrl} onCommit={commitAddress} />}
            {section === "about" && <AboutSection />}
        </div>
      </div>
    </ChildWindow>
  );
}
