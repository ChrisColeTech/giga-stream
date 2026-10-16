import { Rail } from "@/components/ui/Rail";
import { SETTINGS_SECTIONS } from "@/constants/settings-sections";
import type { SettingsSectionId } from "@/constants/settings-sections";

/** Settings' rail: its sections down the left edge of the window. */
export function SettingsRail({ selected, onSelect }: { selected: SettingsSectionId; onSelect: (id: SettingsSectionId) => void }) {
  return <Rail label="Settings sections" entries={SETTINGS_SECTIONS} selected={selected} onSelect={onSelect} />;
}
