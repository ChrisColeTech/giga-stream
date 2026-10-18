import type { BulkIconKey } from "./bulk-icons";

/** The tooltip each bulk verb wears at rest (LoRA Trainer's `GalleryToolbar` titles: what the verb does to the
 *  selection). A disabled verb's reason replaces it. */
export const BULK_TIPS: Readonly<Record<BulkIconKey, string>> = {
  enable: "Enable the ticked rows",
  disable: "Disable the ticked rows",
  rebuild: "Rebuild the ticked rows from their sources",
  sync: "Sync the ticked rows now",
  run: "Run the ticked rows now",
  revert: "Revert the ticked rows to the synced values",
  restore: "Restore the ticked rows",
  delete: "Delete the ticked rows permanently",
};
