import { useEffect, useState } from "react";
import { Activity, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { FIELD_CONTROL, Group, Row, Workspace } from "@/components/ui/Form";
import { FACT_UNKNOWN, SETTINGS_LABELS } from "@/constants/settings-sections";
import { addressToSend } from "@/lib/settings-address";
import { cn } from "@/lib/cn";
import type { StateSnapshot } from "@/services/state";

/* A read-only fact, in LoRA's About pane style. */
const FACT = "flex h-9 items-center font-mono text-sm text-muted";

export interface AdminBackendSectionProps {
  /** The saved admin backend address. The interface shows it and never contacts the backend (`01` section 4.4). */
  readonly adminUrl: string;
  readonly backend: StateSnapshot["backend"];
  /** Saves the address; called on Enter or when the field is left, with the trimmed draft. */
  readonly onCommit: (address: string) => void;
}

/** Admin backend: the address, which saves through the fileserver, and the backend's state as read-only facts, unknown
 *  until the fileserver reports them. */
export function AdminBackendSection({ adminUrl, backend, onCommit }: AdminBackendSectionProps) {
  const [draft, setDraft] = useState(adminUrl);
  const [sent, setSent] = useState(adminUrl);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (edited) return;
    setDraft(adminUrl);
    setSent(adminUrl);
  }, [adminUrl, edited]);

  const commit = () => {
    const next = addressToSend(draft, sent);
    if (next === null) return;
    setSent(next);
    setDraft(next);
    onCommit(next);
  };

  const fact = (label: string, tip: string, value: string) => (
    <Row label={label} tip={tip}>
      <span className={FACT}>{value}</span>
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
            onChange={(event) => {
              setEdited(true);
              setDraft(event.target.value);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) commit();
            }}
          />
        </Row>
      </Group>
      <Group id="settings.admin.state" title="State" icon={Activity} last>
        {fact(
          "Connection",
          "Whether the fileserver reaches the admin backend.",
          backend === undefined ? FACT_UNKNOWN : backend.connected ? "Connected" : "Not connected",
        )}
        {fact("Revision", "The backend's revision, which moves when its data changes.", String(backend?.revision ?? FACT_UNKNOWN))}
        {fact(
          "Channels read",
          "When the channels were last read from the backend.",
          backend?.readAt === undefined ? FACT_UNKNOWN : new Date(backend.readAt).toLocaleString(),
        )}
        {fact("Error", "The last read's error, if it failed.", backend?.error?.message ?? FACT_UNKNOWN)}
      </Group>
    </Workspace>
  );
}
