import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRef } from "react";

import type { MenuAnchor, MenuItem } from "@/types/menu";
import { ContextMenuRow, MENU_PANEL } from "./ContextMenuRow";
import { ContextMenuSubmenu } from "./ContextMenuSubmenu";

/* A context menu has no trigger button: it is summoned AT THE POINTER. So the trigger is a zero-size anchor pinned at
 * those coordinates, and the menu is opened controlled, which is also how closing reports back to the shell. Built on
 * Radix's menu, the family's choice, since it is the only one of the two that carries a submenu. */

export interface ContextMenuProps {
  anchor: MenuAnchor;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ anchor, items, onClose }: ContextMenuProps) {
  const hasTicks = items.some((item) => item.kind === "action" && item.checked !== undefined);
  /* Radix returns focus to ITS trigger, which is the invisible stub below. The card or row the menu was summoned from is
   * where a keyboard user actually was, so that is what gets focus back. */
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement);

  return (
    <Menu.Root
      open
      /* Escape, an outside click and a selected row all arrive here, so the shell learns the menu is gone without owning
         any of that itself. */
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Menu.Trigger
        aria-label="Actions"
        tabIndex={-1}
        className="fixed size-0 overflow-hidden border-0 bg-transparent p-0"
        style={{ left: anchor.x, top: anchor.y }}
      />
      <Menu.Portal>
        <Menu.Content
          align="start"
          side="bottom"
          sideOffset={0}
          collisionPadding={8}
          className={MENU_PANEL}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current instanceof HTMLElement) opener.current.focus();
          }}
        >
          {items.map((item, index) =>
            item.kind === "submenu" ? (
              <ContextMenuSubmenu key={index} row={item} />
            ) : (
              <ContextMenuRow key={index} row={item} hasTicks={hasTicks} />
            ),
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
