import { useState } from "react";
import { Activity, HardDrive } from "lucide-react";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { TextField } from "@/components/ui/TextField";
import { FACT_UNKNOWN, NEEDS_FILESERVER } from "@/constants/settings-sections";
import { addressToSend } from "@/lib/settings-address";

export interface AdminBackendSectionProps {
  /** The saved admin backend address. The interface shows it and never contacts the backend (`01` section 4.4). */
  readonly adminUrl: string;
  /** Saves the address; called on Enter or when the field is left, with the trimmed draft. */
  readonly onCommit: (address: string) => void;
}

/** Admin backend: the address, which saves through the fileserver, and the backend's state as disabled facts. The state
 *  has nothing to act on yet, so its rows stay disabled with their reason. */
export function AdminBackendSection({ adminUrl, onCommit }: AdminBackendSectionProps) {
  const [draft, setDraft] = useState(adminUrl);
  const [sent, setSent] = useState(adminUrl);

  const commit = () => {
    const next = addressToSend(draft, sent);
    if (next === null) return;
    setSent(next);
    setDraft(next);
    onCommit(next);
  };

  return (
    <>
      <Group id="settings.admin" title="Admin backend" icon={HardDrive}>
        <Row label="Address" tip="The admin backend's address. Press Enter or leave the field to save it.">
          <TextField
            aria-label="Admin backend address"
            mono
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) commit();
            }}
          />
        </Row>
      </Group>
      <Group id="settings.admin.state" title="State" icon={Activity} last>
        <Row label="Connection" tip="Whether the fileserver reaches the admin backend." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-[11px] text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Revision" tip="The backend's revision, which moves when its data changes." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-[11px] text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Channels read" tip="When the channels were last read from the backend." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-[11px] text-muted">{FACT_UNKNOWN}</span>
        </Row>
        <Row label="Error" tip="The last read's error, if it failed." reason={NEEDS_FILESERVER}>
          <span className="font-mono text-[11px] text-muted">{FACT_UNKNOWN}</span>
        </Row>
      </Group>
    </>
  );
}
