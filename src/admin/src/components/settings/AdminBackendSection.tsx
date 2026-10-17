import { useState } from "react";
import { Activity, HardDrive } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Workspace } from "@giga/ui/form/Workspace";
import { FACT_UNKNOWN, NEEDS_FILESERVER, SETTINGS_LABELS } from "@/constants/settings-sections";
import { addressToSend } from "@/lib/settings-address";
import { cn } from "@giga/ui/lib/cn";

/* A read-only fact, in LoRA's About pane style. */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

export interface AdminBackendSectionProps {
  /** The saved admin backend address. The interface shows it and never contacts the backend (`01` section 4.4). */
  readonly adminUrl: string;
  /** Saves the address; called on Enter or when the field is left, with the trimmed draft. */
  readonly onCommit: (address: string) => void;
}

/** Admin backend: the address, which saves through the fileserver, and the backend's state as read-only facts, unknown
 *  until the fileserver reports them. */
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

  const fact = (label: string, tip: string) => (
    <Row label={label} tip={tip}>
      <span className={FACT} title={NEEDS_FILESERVER}>{FACT_UNKNOWN}</span>
    </Row>
  );

  return (
    <Workspace labels={SETTINGS_LABELS}>
      <Group id="settings.admin" title="Admin backend" icon={HardDrive}>
        <Row label="Address" tip="The admin backend's address. Press Enter or leave the field to save it.">
          <Input
            aria-label="Admin backend address"
            className={cn(FIELD_CONTROL, "font-mono")}
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
        {fact("Connection", "Whether the fileserver reaches the admin backend.")}
        {fact("Revision", "The backend's revision, which moves when its data changes.")}
        {fact("Channels read", "When the channels were last read from the backend.")}
        {fact("Error", "The last read's error, if it failed.")}
      </Group>
    </Workspace>
  );
}
