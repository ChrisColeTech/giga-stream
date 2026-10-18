import { Segmented } from "@giga/ui/controls/Segmented";
import { Row } from "@giga/ui/form/Row";
import { KIND_TIP, SCOPE_TIP } from "@/constants/job-copy";
import type { JobKind, JobScope } from "@/lib/job-draft";

const SCOPES = [
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Popular" },
] as const;
const KINDS = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "Series" },
] as const;

export interface CatalogRowsProps {
  readonly scope: JobScope;
  readonly kind: JobKind;
  readonly onChange: (patch: { scope?: JobScope; kind?: JobKind }) => void;
}

/** A catalog job's two rows, the same on the New form and in Details: Scope (Trending / Popular) and Kind (Movies /
 *  Series), each a field-size Segmented spanning the row. They are rendered only for a catalog job. */
export function CatalogRows({ scope, kind, onChange }: CatalogRowsProps) {
  return (
    <>
      <Row label="Scope" tip={SCOPE_TIP}>
        <Segmented
          field
          options={SCOPES}
          value={scope}
          aria-label="Scope"
          onChange={(next) => onChange({ scope: next })}
        />
      </Row>
      <Row label="Kind" tip={KIND_TIP}>
        <Segmented field options={KINDS} value={kind} aria-label="Kind" onChange={(next) => onChange({ kind: next })} />
      </Row>
    </>
  );
}
