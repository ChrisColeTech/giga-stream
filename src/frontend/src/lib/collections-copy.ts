import type { CollectionRow, CollectionType } from "@/types/collection";

/** A collection's type, as the select and the index column read it. */
export const TYPE_CHOICES: ReadonlyArray<{ value: CollectionType; label: string }> = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "local", label: "Local" },
];
export const TYPE_LABEL: Readonly<Record<CollectionType, string>> = { movie: "Movies", tv: "TV", local: "Local" };

/* The Collections window's words that carry behaviour: the reasons a control is disabled, the consequence a two-step names,
 * and the field limits. Nothing is printed under a control (`06` section 2, rule 3). */

/** A collection's name is 1 to 80 characters after trimming (`03` section 3.7). */
export const COLLECTION_NAME_MAX = 80;

/** The window's list, and the back link from a collection to it. */
export const LIST_LABEL = "Collections";

/** Why a collection read or write cannot be honoured: a signed-out browser has no home for collections
 *  (`62` section 3.6). */
export const COLLECTIONS_SIGNED_OUT = "Sign in to use collections.";

/** Why a name cannot be sent: nothing to act on (`06` section 2, rule 3). */
export const NAME_BLOCK_REASON: Readonly<Record<"blank" | "unchanged", string>> = {
  blank: "Type a name first.",
  unchanged: "The name has not changed.",
};

export const SCANNING_REASON = "The folder is already scanning.";

/** An armed two-step waits this long for its second press, then disarms (`01` section 9). */
export const ARM_TIMEOUT_MS = 5000;

/** The armed state of a removal: the control's new label and the sentence that names what the removal leaves alone. */
export const FOLDER_ARMED_LABEL = "Remove folder?";
/** What removing a folder leaves on disk (`03` section 3.8: its files are never touched). */
export const FOLDER_CONSEQUENCE = "The files on disk stay.";

/** A folder that has never finished a scan. */
export const NEVER_SCANNED = "Never scanned";

/** A member whose item the library does not hold (never drawn as a raw identifier). */
export const MEMBER_MISSING = "Not in the library";

/** The rows drawn while a members or folders list has none. */
export const SKELETON_ROW_COUNT = 3;

export const SCAN_LABEL: Readonly<Record<CollectionRow["scan"], string>> = {
  idle: "Idle",
  scanning: "Scanning",
  failed: "Failed",
};
