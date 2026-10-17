import { LIBRARY_COPY } from "@/lib/library-copy";
import { openMenu } from "@/lib/menu";
import type { MenuEvent } from "./card-menu";

const noop = (): void => undefined;

/** A collection's context menu. Rename and Remove are two-step work in Manage collections, where the name and the
 *  confirmation live, so both are drawn disabled here and say where to act. */
export function openCollectionMenu(event: MenuEvent): void {
  openMenu(event, [
    { kind: "action", label: "Rename", disabled: true, disabledReason: LIBRARY_COPY.renameInManage, onSelect: noop },
    { kind: "separator" },
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
