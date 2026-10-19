import { useState } from "react";
import { workSpec } from "@giga/ui/lib/child-metrics";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { SettingsFrame } from "@giga/ui/windows/SettingsFrame";
import { AboutSection } from "@/components/settings/AboutSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { SessionSection } from "@/components/settings/SessionSection";
import { SETTINGS_LABELS, SETTINGS_SECTIONS, type SettingsSectionId } from "@/constants/settings-sections";
import { useAppStore } from "@/store/app-store";

const SPEC = workSpec("settings", "Settings");

/** Settings: a work child window, the template's (`28` Appendix A, row 60): centred at its content's size, at most 80% of
 *  the main window, moved by its header, resized by its grips, remembered for the run, modal. The header carries the title
 *  and the close X; the body is the library's frame, the rail and the selected page. Three pages: Appearance, Session,
 *  About (the security question is set per account in the Accounts workspace, docs/54). Theme, motion, accent and zoom
 *  live in the store and apply at once; nothing is saved yet (Wave 7). */
export function SettingsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const [section, setSection] = useState<SettingsSectionId>("appearance");

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <SettingsFrame sections={SETTINGS_SECTIONS} selected={section} onSelect={setSection} labels={SETTINGS_LABELS}>
        {section === "appearance" && <AppearanceSection />}
        {section === "session" && <SessionSection />}
        {section === "about" && <AboutSection />}
      </SettingsFrame>
    </ChildWindow>
  );
}
