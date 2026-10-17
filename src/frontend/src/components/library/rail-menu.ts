import { LIBRARY_COPY } from "@/lib/library-copy";
import { openMenu } from "@/lib/menu";
import type { MenuEvent } from "./card-menu";

const noop = (): void => undefined;

/** A collection's context menu. Attach folder acts here, so a folder is one click from the rail. Rename and Remove are
 *  two-step work in Manage collections, where the name and the confirmation live, so both say where to act. */
export function openCollectionMenu(event: MenuEvent, onAttach: () => void): void {
  openMenu(event, [
    { kind: "action", label: "Attach folder…", onSelect: onAttach },
    { kind: "separator" },
    { kind: "action", label: "Rename", disabled: true, disabledReason: LIBRARY_COPY.renameInManage, onSelect: noop },
    {
      kind: "action",
      label: "Remove",
      danger: true,
      disabled: true,
      disabledReason: LIBRARY_COPY.removeInManage,
      onSelect: noop,
    },
  ]);
}
