import { Segmented } from "@giga/ui/controls/Segmented";
import { Row } from "@giga/ui/form/Row";
import { KIND_TIP, SCOPE_TIP } from "@/constants/job-copy";
import { type JobKind, type JobScope, walksBothKinds } from "@/lib/job-draft";

const SCOPES = [
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Popular" },
  { value: "discover", label: "Discover" },
  { value: "recent", label: "Recent" },
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

/** A catalog job's rows, the same on the New form and in Details: Scope (Trending / Popular / Discover / Recent) and Kind
 *  (Movies / Series), each a field-size Segmented spanning the row. A discover walk and a recent update cover both kinds,
 *  so they have no Kind row. They are rendered only for a catalog job. */
export function CatalogRows({ scope, kind, onChange }: CatalogRowsProps) {
  return (
    <>
      <Row label="Scope" tip={SCOPE_TIP}>
        <Segmented options={SCOPES} value={scope} aria-label="Scope" onChange={(next) => onChange({ scope: next })} />
      </Row>
      {!walksBothKinds(scope) && (
        <Row label="Kind" tip={KIND_TIP}>
          <Segmented options={KINDS} value={kind} aria-label="Kind" onChange={(next) => onChange({ kind: next })} />
        </Row>
      )}
    </>
  );
}
