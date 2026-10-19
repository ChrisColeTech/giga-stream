import { FileText } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Toggle } from "@giga/ui/controls/Toggle";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { ENABLED_TIP, NAME_TIP, PLAYLIST_TIP, TYPE_FIXED_TIP } from "@/constants/job-copy";
import type { JobDraft } from "@/lib/job-draft";
import { targetOf, typeWord } from "@/lib/job-rows";
import type { FormErrors } from "@/lib/record-form";
import type { AdminJob } from "@/services/schemas/job-schema";
import { CatalogRows } from "./CatalogRows";

export interface JobDetailsGroupProps {
  readonly job: AdminJob;
  readonly draft: JobDraft;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<JobDraft>) => void;
}

/** `Details` (`38` section 4.3, `43` section 3.1): Name first (a playlist job's is `Sync <playlist>`, built by the backend,
 *  so read-only), Type (read-only: it never changes), then the type's rows (the Playlist it belongs to, read-only, or
 *  Scope and Kind), `Enabled` (the switch), and a catalog job's Pages (1 to 500; a Library update has none). */
export function JobDetailsGroup({ job, draft, errors, onChange }: JobDetailsGroupProps) {
  const catalog = job.type === "catalog";
  return (
    <Group id="jw-details" icon={FileText} title="Details">
      <Row label="Name" tip={NAME_TIP} error={errors["name"]}>
        <Input
          type="text"
          value={draft.name}
          readOnly={!catalog}
          className={catalog ? FIELD_CONTROL : `${FIELD_CONTROL} text-faint`}
          aria-label="Name"
          aria-invalid={errors["name"] !== undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Row>
      <Row label="Type" tip={TYPE_FIXED_TIP}>
        <Input type="text" value={typeWord(job)} readOnly className={`${FIELD_CONTROL} text-faint`} aria-label="Type" />
      </Row>
      {catalog ? (
        <CatalogRows
          scope={draft.scope}
          kind={draft.kind}
          pages={draft.pages}
          errors={errors}
          onChange={onChange}
        />
      ) : (
        <Row label="Playlist" tip={PLAYLIST_TIP}>
          <Input type="text" value={targetOf(job)} readOnly className={`${FIELD_CONTROL} text-faint`} aria-label="Playlist" />
        </Row>
      )}
      <Row label="Enabled" tip={ENABLED_TIP} error={errors["enabled"]}>
        <Toggle checked={draft.enabled} aria-label="Enabled" onChange={(enabled) => onChange({ enabled })} />
      </Row>
    </Group>
  );
}
