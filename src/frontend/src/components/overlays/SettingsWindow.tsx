import { useState } from "react";
import { AboutSection } from "@/components/settings/AboutSection";
import { AdminBackendSection } from "@/components/settings/AdminBackendSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { PlaybackSection } from "@/components/settings/PlaybackSection";
import { SessionSection } from "@/components/settings/SessionSection";
import { workSpec } from "@/constants/child-window";
import { SETTINGS_LABELS, SETTINGS_SECTIONS, type SettingsSectionId } from "@/constants/settings-sections";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { SettingsFrame } from "@giga/ui/windows/SettingsFrame";

const SPEC = workSpec("settings", "Settings");

/** Settings: a Work child window. The header carries the title and the close X; the body is the rail and the workspace
 *  beside it. The admin backend address saves through the fileserver. Theme, motion, accent, zoom, and the playback and
 *  Library preferences live in the store and apply at once; phase 2 saves them through the fileserver. */
export function SettingsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const openCollections = useAppStore((state) => state.openCollections);
  const requestLibrary = useAppStore((state) => state.requestLibrary);
  const adminUrl = useAppStore((state) => state.adminUrl);
  const setAdminUrl = useAppStore((state) => state.setAdminUrl);
  const savedSettingsRevision = useAppStore((state) => state.savedSettingsRevision);
  const backend = useAppStore((state) => state.backend);
  const appVersion = useAppStore((state) => state.appVersion);
  const runtime = useAppStore((state) => state.runtime);
  const [section, setSection] = useState<SettingsSectionId>("appearance");

  /* Closes Settings and shows the library on its History view (the request closes the window with it). */
  const openHistory = () => requestLibrary({ source: "history" });

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <SettingsFrame sections={SETTINGS_SECTIONS} selected={section} onSelect={setSection} labels={SETTINGS_LABELS}>
        {section === "appearance" && <AppearanceSection />}
        {section === "playback" && <PlaybackSection />}
        {section === "library" && (
          <LibrarySection onOpenCollections={() => openCollections()} onOpenHistory={openHistory} />
        )}
        {section === "admin" && (
          <AdminBackendSection
            adminUrl={adminUrl}
            savedRevision={savedSettingsRevision}
            backend={backend}
            onCommit={setAdminUrl}
          />
        )}
        {section === "session" && <SessionSection />}
        {section === "about" && <AboutSection version={appVersion} runtime={runtime} />}
      </SettingsFrame>
    </ChildWindow>
  );
}
