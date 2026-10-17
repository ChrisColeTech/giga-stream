import { cn } from "@/lib/cn";
import { SCAN_LABEL } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";

/** A folder's scan state in the folders table: the word in the state ramp's color (never a dot), pulsing while a scan
 *  runs, as the Library rail says it. */
export function ScanState({ scan }: { readonly scan: CollectionRow["scan"] }) {
  return (
    <span
      className={cn(
        "truncate",
        scan === "scanning" && "animate-pulse-busy text-st-generating",
        scan === "failed" && "text-st-failed",
      )}
    >
      {SCAN_LABEL[scan]}
    </span>
  );
}
