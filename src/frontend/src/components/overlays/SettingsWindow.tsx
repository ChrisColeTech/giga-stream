import { useState } from "react";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { PendingSection } from "@/components/settings/PendingSection";
import { SettingsRail } from "@/components/settings/SettingsRail";
import { Workspace } from "@/components/ui/Workspace";
import { workSpec } from "@/constants/child-window";
import type { SettingsSectionId } from "@/constants/settings-sections";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("settings", "Settings");

/** Settings: a Work child window. The header carries the title and the close X; the body is the rail and the workspace
 *  beside it, the same rail and the same scrolling body the surface has always had. */
export function SettingsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const [section, setSection] = useState<SettingsSectionId>("appearance");

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
        <SettingsRail selected={section} onSelect={setSection} />
        <div role="tabpanel" aria-label={section} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Workspace>
            {section === "appearance" ? <AppearanceSection /> : <PendingSection section={section} />}
          </Workspace>
        </div>
      </div>
    </ChildWindow>
  );
}
