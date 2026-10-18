import { Check, Play, RotateCcw, X, type LucideIcon } from "lucide-react";

/** The icon drawn before each bulk verb's word in a table's selection toolbar (`01` section 9, Icon vocabulary). Every
 *  icon is the family's: Enable is LoRA Trainer's Keep (`Check`) and Disable its Reject (`X`), Run is the interface's
 *  Play, Revert and Restore its `Restore defaults` (`RotateCcw`). Rebuild, Sync now and Delete have no family icon and
 *  are their word alone; Delete is the armed two-step, which never draws one. */
export type BulkIconKey = "enable" | "disable" | "rebuild" | "sync" | "run" | "revert" | "restore" | "delete";

export const BULK_ICONS: Readonly<Partial<Record<BulkIconKey, LucideIcon>>> = {
  enable: Check,
  disable: X,
  run: Play,
  revert: RotateCcw,
  restore: RotateCcw,
};
