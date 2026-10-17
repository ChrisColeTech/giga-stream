import { openMenu } from "@/lib/menu";
import type { MenuEvent } from "./card-menu";

/** A collection's context menu. Attach folder acts here, so a folder is one click from the rail. Rename and Remove are
 *  work in the Collections window, where the name field and the two-step confirmation live, so both open it on this
 *  collection. Neither is danger here: nothing is removed until the window's own two-step. */
export function openCollectionMenu(event: MenuEvent, onAttach: () => void, onManage: () => void): void {
  openMenu(event, [
    { kind: "action", label: "Attach folder…", onSelect: onAttach },
    { kind: "separator" },
    { kind: "action", label: "Rename…", onSelect: onManage },
    { kind: "action", label: "Remove…", onSelect: onManage },
  ]);
}
