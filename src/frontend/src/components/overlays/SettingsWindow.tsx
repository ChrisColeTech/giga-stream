import { useState } from "react";
import { AboutSection } from "@/components/settings/AboutSection";
import { AdminBackendSection } from "@/components/settings/AdminBackendSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { PlaybackSection } from "@/components/settings/PlaybackSection";
import { SettingsRail } from "@/components/settings/SettingsRail";
import { Workspace } from "@/components/ui/Workspace";
import { workSpec } from "@/constants/child-window";
import type { SettingsSectionId } from "@/constants/settings-sections";
import { SETTINGS_VALUES } from "@/fixtures/settings";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("settings", "Settings");

/** Settings: a Work child window. The header carries the title and the close X; the body is the rail and the workspace
 *  beside it. Autoplay, the subtitle language and the default view are held here, seeded from the fixture, so a section
 *  switch keeps them (phase 1; they are not saved yet). Theme, motion, accent and zoom live in the store. */
export function SettingsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const setSurface = useAppStore((state) => state.setSurface);
  const [section, setSection] = useState<SettingsSectionId>("appearance");
  const [autoplay, setAutoplay] = useState(SETTINGS_VALUES.autoplay);
  const [subtitleLanguage, setSubtitleLanguage] = useState(SETTINGS_VALUES.subtitleLanguage);
  const [libraryView, setLibraryView] = useState(SETTINGS_VALUES.libraryView);

  /* Phase 1: the library's History view belongs to the Library surface, so this only closes Settings and selects the
     library. */
  const openHistory = () => {
    closeOverlay();
    setSurface("library");
  };

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
        <SettingsRail selected={section} onSelect={setSection} />
        <div role="tabpanel" aria-label={section} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Workspace>
            {section === "appearance" && <AppearanceSection />}
            {section === "playback" && (
              <PlaybackSection
                autoplay={autoplay}
                onAutoplay={setAutoplay}
                subtitleLanguage={subtitleLanguage}
                onSubtitleLanguage={setSubtitleLanguage}
              />
            )}
            {section === "library" && (
              <LibrarySection
                libraryView={libraryView}
                onLibraryView={setLibraryView}
                onOpenCollections={() => openOverlay("collections")}
                onOpenHistory={openHistory}
              />
            )}
            {section === "admin" && <AdminBackendSection adminUrl={SETTINGS_VALUES.adminUrl} />}
            {section === "about" && <AboutSection />}
          </Workspace>
        </div>
      </div>
    </ChildWindow>
  );
}
