import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { JOB_KIND_OPTIONS, JOB_SCOPE_OPTIONS, KIND_TIP, PAGES_TIP, SCOPE_TIP } from "@/constants/job-copy";
import { type JobKind, type JobScope, hasPages, walksBothKinds } from "@/lib/job-draft";
import type { FormErrors } from "@/lib/record-form";

export interface CatalogRowsProps {
  readonly scope: JobScope;
  readonly kind: JobKind;
  readonly pages: string;
  readonly errors: FormErrors;
  readonly onChange: (patch: { scope?: JobScope; kind?: JobKind; pages?: string }) => void;
}

/** Shared catalog fields. Scope and Kind are selects; Discover/Recent omit Kind and Pages because both are ignored. */
export function CatalogRows({ scope, kind, pages, errors, onChange }: CatalogRowsProps) {
  return (
    <>
      <Row label="Scope" tip={SCOPE_TIP}>
        <Select
          value={scope}
          className={FIELD_CONTROL}
          aria-label="Scope"
          onChange={(event) => onChange({ scope: event.target.value as JobScope })}
        >
          {JOB_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </Row>
      {!walksBothKinds(scope) && (
        <Row label="Kind" tip={KIND_TIP}>
          <Select
            value={kind}
            className={FIELD_CONTROL}
            aria-label="Kind"
            onChange={(event) => onChange({ kind: event.target.value as JobKind })}
          >
            {JOB_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Row>
      )}
      {hasPages(scope) && (
        <Row label="Pages" tip={PAGES_TIP} error={errors["pages"]}>
          <Input
            type="text"
            inputMode="numeric"
            value={pages}
            className={`${FIELD_CONTROL} font-mono`}
            aria-label="Pages"
            aria-invalid={errors["pages"] !== undefined}
            autoComplete="off"
            onChange={(event) => onChange({ pages: event.target.value })}
          />
        </Row>
      )}
    </>
  );
}
