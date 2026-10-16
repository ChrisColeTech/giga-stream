import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import type { MenuItem } from "@/types/menu";
import { ContextMenuRow, MENU_PANEL, MENU_ROW } from "./ContextMenuRow";

/* `Collections ▸`, the one submenu `06` section 4.5 specifies. Radix's `Sub` gives hover-to-open with the diagonal safe
 * triangle, ArrowRight in and ArrowLeft back out, Escape closing the flyout before the menu, and collision-aware
 * flipping. Everything below it is skin. */

type SubmenuRow = Extract<MenuItem, { kind: "submenu" }>;

export interface ContextMenuSubmenuProps {
  row: SubmenuRow;
}

export function ContextMenuSubmenu({ row }: ContextMenuSubmenuProps) {
  const hasTicks = row.items.some((item) => item.kind === "action" && item.checked !== undefined);

  return (
    <Menu.Sub>
      <Menu.SubTrigger className={cn(MENU_ROW, "justify-between data-[state=open]:bg-hov data-[state=open]:text-text")}>
        <span className="flex items-center gap-2">
          {row.icon}
          <span>{row.label}</span>
        </span>
        <ChevronRight aria-hidden className="text-dim" />
      </Menu.SubTrigger>

      <Menu.Portal>
        <Menu.SubContent sideOffset={2} collisionPadding={8} className={MENU_PANEL}>
          {row.items.map((item, index) => (
            <ContextMenuRow key={index} row={item} hasTicks={hasTicks} />
          ))}
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  );
}
