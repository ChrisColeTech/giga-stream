import { NEVER_SCANNED } from "@/lib/collections-copy";

/** A folder's last finished scan as the folders table draws it: a short local date and time ("Sep 21, 10:42 PM"), which
 *  fits its column untruncated, or the never-scanned word. The year is left out; the full stamp is the cell's tooltip. */
export function lastScanLabel(at: number | undefined): string {
  if (at === undefined) return NEVER_SCANNED;
  return new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The full stamp of a folder's last scan, for the cell's tooltip. */
export function lastScanTitle(at: number | undefined): string | undefined {
  return at === undefined ? undefined : new Date(at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
}
