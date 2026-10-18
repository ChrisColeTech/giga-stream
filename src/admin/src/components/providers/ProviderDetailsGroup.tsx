import { FileText } from "lucide-react";
import { Segmented } from "@giga/ui/controls/Segmented";
import { Toggle } from "@giga/ui/controls/Toggle";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { NumericInput } from "@giga/ui/form/NumericInput";
import { Row } from "@giga/ui/form/Row";
import {
  CREATED_TIP,
  ENABLED_TIP,
  FAMILY_OPTIONS,
  FAMILY_TIP,
  MOVIE_TEMPLATE_TIP,
  ORDER_TIP,
  SOURCE_TIP,
} from "@/constants/provider-copy";
import { formatWhen } from "@/lib/format-when";
import { showsTemplates, type ProviderDraft } from "@/lib/provider-draft";
import { createdAt } from "@/lib/provider-rows";
import type { FormErrors } from "@/lib/record-form";
import { ProviderTextRow } from "./ProviderTextRow";

export interface ProviderDetailsGroupProps {
  readonly draft: ProviderDraft;
  readonly created: string;
  readonly errors: FormErrors;
  readonly onChange: (patch: Partial<ProviderDraft>) => void;
}

/** `Details` (`37` section 3.3): Name, Family (changing it re-renders the template rows), Source, Movie template (an
 *  embed provider only), the Enabled switch over `is_active`, Order, and Created, read-only, `YYYY-MM-DD HH:mm` local. */
export function ProviderDetailsGroup({ draft, created, errors, onChange }: ProviderDetailsGroupProps) {
  return (
    <Group id="pv-details" icon={FileText} title="Details">
      <ProviderTextRow label="Name" value={draft.name} error={errors["name"]} onChange={(name) => onChange({ name })} />
      <Row label="Family" tip={FAMILY_TIP} error={errors["family"]}>
        <Segmented
          field
          aria-label="Family"
          options={FAMILY_OPTIONS}
          value={draft.family}
          onChange={(family) => onChange({ family })}
        />
      </Row>
      <ProviderTextRow
        label="Source"
        tip={SOURCE_TIP}
        value={draft.source}
        error={errors["source"]}
        onChange={(source) => onChange({ source })}
      />
      {showsTemplates(draft.family) && (
        <ProviderTextRow
          label="Movie template"
          tip={MOVIE_TEMPLATE_TIP}
          value={draft.movieTemplate}
          error={errors["movieTemplate"]}
          onChange={(movieTemplate) => onChange({ movieTemplate })}
        />
      )}
      <Row label="Enabled" tip={ENABLED_TIP} error={errors["enabled"]}>
        <Toggle checked={draft.enabled} aria-label="Enabled" onChange={(enabled) => onChange({ enabled })} />
      </Row>
      <Row label="Order" tip={ORDER_TIP} error={errors["order"]}>
        <NumericInput
          value={draft.order}
          min={0}
          className={FIELD_CONTROL}
          aria-label="Order"
          aria-invalid={errors["order"] !== undefined}
          onChange={(order) => onChange({ order: Math.round(order) })}
        />
      </Row>
      <Row label="Created" tip={CREATED_TIP}>
        <span className="flex h-9 items-center font-mono text-sm text-muted">{formatWhen(createdAt(created))}</span>
      </Row>
    </Group>
  );
}
