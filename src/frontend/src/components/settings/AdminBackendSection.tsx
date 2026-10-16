import { Activity, HardDrive } from "lucide-react";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { TextField } from "@/components/ui/TextField";
import { FACT_UNKNOWN, NEEDS_FILESERVER } from "@/constants/settings-sections";

export interface AdminBackendSectionProps {
  /** The admin backend's address as the settings fixture holds it: empty in phase 1. Shown, never contacted. */
  readonly adminUrl: string;
}

/** Admin backend: the address field, disabled, and the backend's state as disabled facts. The interface never contacts
 *  the backend (`01` section 4.4), so nothing here sends a request. */
export function AdminBackendSection({ adminUrl }: AdminBackendSectionProps) {
  return (
    <>
      <Group id="settings.admin" title="Admin backend" icon={HardDrive}>
        <Row label="Address" tip="The admin backend's address, saved with the other settings.">
          <TextField
            aria-label="Admin backend address"
            value={adminUrl}
            readOnly
            disabled
            title={NEEDS_FILESERVER}
          />
        </Row>
      </Group>
      <Group id="settings.admin.state" title="State" icon={Activity} last>
        <Row label="Connection" tip="Whether the fileserver reaches the admin backend." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-xs text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Revision" tip="The backend's revision, which moves when its data changes." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-xs text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Channels read" tip="When the channels were last read from the backend." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-xs text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Error" tip="The last read's error, if it failed." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-xs text-muted">{FACT_UNKNOWN}</span>
        </Row>
      </Group>
    </>
  );
}
