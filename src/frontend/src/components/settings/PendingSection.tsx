import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { PENDING_ROWS, SETTINGS_SECTIONS } from "@/constants/settings-sections";
import type { SettingsSectionId } from "@/constants/settings-sections";

/** A section whose piece does not exist yet. Its rows are named, so the surface is complete in shape, and each is disabled
 *  with its refusal sentence on the row: a control works or says why it does not. */
export function PendingSection({ section }: { section: Exclude<SettingsSectionId, "appearance"> }) {
  const { label, icon } = SETTINGS_SECTIONS.find((entry) => entry.id === section)!;
  return (
    <Group id={`settings.${section}`} title={label} icon={icon} last>
      {PENDING_ROWS[section].map((row) => (
        <Row key={row.label} label={row.label} tip={row.tip} reason={row.reason}>
          <span className="font-mono text-xs text-dim">{row.reason}</span>
        </Row>
      ))}
    </Group>
  );
}
