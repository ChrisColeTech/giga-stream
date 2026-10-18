import { FileText, Link } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Toggle } from "@giga/ui/controls/Toggle";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { SaveDetails } from "@/components/records/SaveDetails";
import type { SaveVerb } from "@/lib/workspace-verbs";
import { ADDRESS_TIP, ENABLED_TIP, FILE_ADDRESS_TIP, NAME_TIP, REPLACE_TITLE } from "@/constants/playlist-copy";
import { replaceReason, startReplace, type PlaylistDraft } from "@/lib/playlist-draft";
import { sourceOf } from "@/lib/playlist-rows";
import type { FormErrors } from "@/lib/record-form";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

export interface PlaylistDetailsGroupProps {
  readonly playlist: AdminPlaylist;
  readonly draft: PlaylistDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<PlaylistDraft>) => void;
  /** The form's one commit, ending this group. */
  readonly save: SaveVerb;
}

/** `Details` (`38` section 3.3): Name (first), Address, Enabled. The Address shows the backend's `masked` (a file
 *  playlist, its file name), read-only and mono, with a ghost `Replace` at the row's end. `Replace` unlocks it as an EMPTY
 *  password field (never prefilled: the address is never shown back) and disables itself with `Type the new value, then
 *  Save.`; left empty, nothing is sent. For a file playlist `Replace` is disabled: it has no web address, so the file is
 *  imported again. Masking is display only: the stored address changes only when a new one is saved. */
export function PlaylistDetailsGroup({ playlist, draft, errors, onChange, save }: PlaylistDetailsGroupProps) {
  const locked = !draft.replacing;
  const reason = replaceReason(draft, playlist);
  const replace = (
    <Button variant="ghost" reason={reason} onClick={() => onChange(startReplace(draft))}>
      <Link aria-hidden /> Replace
    </Button>
  );
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
        trailing={reason === undefined ? <Tooltip text={REPLACE_TITLE}>{replace}</Tooltip> : replace}
      >
        {locked ? (
          <Input
            type="text"
            value={sourceOf(playlist)}
            readOnly
            className={`${FIELD_CONTROL} font-mono text-faint`}
            aria-label="Address"
          />
        ) : (
          <Input
            type="password"
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
      <SaveDetails save={save} />
    </Group>
  );
}
