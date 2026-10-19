import { FileText } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Toggle } from "@giga/ui/controls/Toggle";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { ADDRESS_TIP, ENABLED_TIP, FILE_ADDRESS_TIP, NAME_TIP } from "@/constants/playlist-copy";
import type { PlaylistDraft } from "@/lib/playlist-draft";
import type { FormErrors } from "@/lib/record-form";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

export interface PlaylistDetailsGroupProps {
  readonly playlist: AdminPlaylist;
  readonly draft: PlaylistDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<PlaylistDraft>) => void;
}

/** `Details` (`38` section 3.3, `43` section 4.1): Name (first), Address, Enabled. A web playlist's Address is an
 *  editable plain text field holding the full address (owner, 2026-10-18), saved with the toolbar's ONE Save and
 *  checked by the same address rule; a file playlist shows its file name, read-only. */
export function PlaylistDetailsGroup({ playlist, draft, errors, onChange }: PlaylistDetailsGroupProps) {
  return (
    <Group id="pw-details" icon={FileText} title="Details">
      <Row label="Name" tip={NAME_TIP} error={errors["name"]}>
        <Input
          type="text"
          value={draft.name}
          className={FIELD_CONTROL}
          aria-label="Name"
          aria-invalid={errors["name"] !== undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Row>
      <Row
        label="Address"
        tip={playlist.kind === "file" ? FILE_ADDRESS_TIP : ADDRESS_TIP}
        error={errors["address"]}
      >
        {playlist.kind === "file" ? (
          <Input
            type="text"
            value={playlist.fileName ?? playlist.name}
            readOnly
            className={`${FIELD_CONTROL} font-mono text-faint`}
            aria-label="Address"
          />
        ) : (
          <Input
            type="text"
            value={draft.address}
            className={FIELD_CONTROL}
            aria-label="Address"
            aria-invalid={errors["address"] !== undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ address: event.target.value })}
          />
        )}
      </Row>
      <Row label="Enabled" tip={ENABLED_TIP} error={errors["enabled"]}>
        <Toggle checked={draft.enabled} aria-label="Enabled" onChange={(enabled) => onChange({ enabled })} />
      </Row>
    </Group>
  );
}
