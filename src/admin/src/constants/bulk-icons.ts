import { ArchiveRestore, CloudDownload, Hammer, Play, Power, PowerOff, Trash2, Undo2, type LucideIcon } from "lucide-react";

/** The icon of each bulk verb in a table strip (`01` section 9: pane toolbars use icons). The verb's name is its
 *  tooltip and `aria-label`; Delete is the armed two-step and draws no icon (its icon is only the fallback). */
export type BulkIconKey = "enable" | "disable" | "rebuild" | "sync" | "run" | "revert" | "restore" | "delete";

export const BULK_ICONS: Readonly<Record<BulkIconKey, LucideIcon>> = {
  enable: Power,
  disable: PowerOff,
  rebuild: Hammer,
  sync: CloudDownload,
  run: Play,
  revert: Undo2,
  restore: ArchiveRestore,
  delete: Trash2,
};
