import { useState } from "react";
import { AboutSection } from "@/components/settings/AboutSection";
import { AdminBackendSection } from "@/components/settings/AdminBackendSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { PlaybackSection } from "@/components/settings/PlaybackSection";
import { SettingsRail } from "@/components/settings/SettingsRail";
import { workSpec } from "@/constants/child-window";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/constants/settings-sections";
import { SETTINGS_VALUES } from "@/fixtures/settings";
import { useAppStore } from "@/store/app-store";
import { saveSetting } from "@/services/settings";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("settings", "Settings");

/** Settings: a Work child window. The header carries the title and the close X; the body is the rail and the workspace
 *  beside it. The admin backend address saves through the fileserver. Theme, motion, accent, zoom, and the playback and
 *  Library preferences live in the store and apply at once; phase 2 saves them through the fileserver. */
export function SettingsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const setSurface = useAppStore((state) => state.setSurface);
  const say = useAppStore((state) => state.say);
  const [section, setSection] = useState<SettingsSectionId>("appearance");

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
        <div
          role="tabpanel"
          aria-label={SETTINGS_SECTIONS.find((entry) => entry.id === section)?.label ?? section}
          className="flex min-h-0 min-w-0 flex-1 flex-col">
          {section === "appearance" && <AppearanceSection />}
          {section === "playback" && <PlaybackSection />}
          {section === "library" && (
            <LibrarySection onOpenCollections={() => openOverlay("collections")} onOpenHistory={openHistory} />
          )}
          {section === "admin" && <AdminBackendSection adminUrl={SETTINGS_VALUES.adminUrl} onCommit={commitAddress} />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
    </ChildWindow>
  );
}
