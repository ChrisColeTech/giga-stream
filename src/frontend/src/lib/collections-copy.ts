import type { CollectionRow } from "@/types/collection";

/* The Collections window's words that carry behaviour: the reasons every phase-1 control shows as its tooltip, the
 * consequence the two-step names, and the field limits. Nothing is printed under a control (`06` section 2, rule 3). */

/** A collection's name is 1 to 80 characters after trimming (`03` section 3.7). */
export const COLLECTION_NAME_MAX = 80;

export const RAIL_LABEL = "Collections";
export const RAIL_ALL = "All";

/* Each reason names the cause in plain words: a collection action needs the library service, a folder action needs the
 * fileserver, and this build has neither. */
export const CREATE_REASON = "Creating a collection needs the library service, which this build does not have.";
export const RENAME_REASON = "Renaming a collection needs the library service, which this build does not have.";
export const REMOVE_MEMBER_REASON =
  "Removing a title from a collection needs the library service, which this build does not have.";
export const REMOVE_COLLECTION_REASON =
  "Removing a collection needs the library service, which this build does not have.";
export const ATTACH_REASON = "Attaching a folder needs the fileserver, which this build does not have.";
export const REPLACE_REASON = "Replacing a folder needs the fileserver, which this build does not have.";
export const RESCAN_REASON = "Rescanning a folder needs the fileserver, which this build does not have.";
export const CANCEL_SCAN_REASON = "Cancelling a scan needs the fileserver, which this build does not have.";
export const REMOVE_FOLDER_REASON = "Removing a folder needs the fileserver, which this build does not have.";

/** The two-step's armed state: the control's new label and the sentence that names what the removal leaves alone. */
export const ARMED_LABEL = "Remove collection?";
export const CONSEQUENCE = "Original files remain untouched.";

/** A folder that has never finished a scan. */
export const NEVER_SCANNED = "Never scanned";

/** A member whose item the library does not hold (never drawn as a raw identifier). */
export const MEMBER_MISSING = "Not in the library";

export const SCAN_LABEL: Readonly<Record<CollectionRow["scan"], string>> = {
  idle: "Idle",
  scanning: "Scanning",
  failed: "Failed",
};
