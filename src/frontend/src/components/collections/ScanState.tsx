import { StatusDot } from "@/components/ui/StatusDot";
import type { DotState } from "@/components/ui/StatusDot";
import { SCAN_LABEL } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";

const DOT: Partial<Record<CollectionRow["scan"], DotState>> = { scanning: "running", failed: "failed" };

/** A scan state: the word always, and a dot while a scan runs or has failed, so colour is never the only signal. */
export function ScanState({ scan }: { readonly scan: CollectionRow["scan"] }) {
  const dot = DOT[scan];
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {dot !== undefined && <StatusDot state={dot} />}
      <span className="truncate">{SCAN_LABEL[scan]}</span>
    </span>
  );
}
