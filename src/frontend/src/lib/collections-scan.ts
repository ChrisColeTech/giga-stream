import { NEVER_SCANNED } from "@/lib/collections-copy";

/** A folder's last finished scan as the folders table draws it: a local date and time, or the never-scanned word. */
export function lastScanLabel(at: number | undefined): string {
  if (at === undefined) return NEVER_SCANNED;
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
