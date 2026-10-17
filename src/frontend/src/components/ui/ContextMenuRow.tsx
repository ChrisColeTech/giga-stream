import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

import type { MenuRow } from "@/types/menu";

/* One row of a context menu, and the class vocabulary every panel shares. Radix owns the row's ARIA, its roving focus
 * and its typeahead; every colour, radius, shadow and duration below still comes from the tokens. `data-highlighted`
 * is Radix's keyboard-or-pointer focus flag. */

/** The panel's own box, shared by the menu and its submenus. The drop shadow is a token. */
export const MENU_PANEL =
  "z-70 min-w-[190px] rounded-card border border-border bg-panel p-1 " +
  "shadow-[var(--shadow-menu)] animate-menu-in focus:outline-none";

export const MENU_ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2 py-1.5 " +
  "text-left font-sans text-[13px] text-muted transition-colors duration-fade ease-linear outline-none " +
  "select-none data-highlighted:bg-hov data-highlighted:text-text active:bg-hov active:text-faint " +
  "data-disabled:pointer-events-none data-disabled:cursor-default data-disabled:opacity-40 " +
  "[&_svg]:size-3.5 [&_svg]:flex-none " +
  /* A variant, so it beats the base `text-muted`: an appended colour class shares a layer and loses on order. */
  "data-danger:text-st-failed";

export interface ContextMenuRowProps {
  row: MenuRow;
  /** Reserved for the whole panel whenever ANY of its rows is checkable, so labels do not shift as membership toggles. */
  hasTicks: boolean;
}

export function ContextMenuRow({ row, hasTicks }: ContextMenuRowProps) {
  if (row.kind === "separator") {
    return <Menu.Separator className="mx-0.5 my-1 h-px bg-hair" />;
  }
  if (row.kind === "heading") {
    return (
      <Menu.Label className="px-2 pt-1.25 pb-0.75 font-sans text-[11px] font-semibold text-faint">{row.label}</Menu.Label>
    );
  }
  return (
    <Menu.Item
      disabled={row.disabled}
      /* A disabled row stays visible and says why. */
      title={row.disabled ? row.disabledReason : undefined}
      data-danger={row.danger === true ? "" : undefined}
      className={MENU_ROW}
      /* Radix closes the menu on select, which is what every row here wants. */
      onSelect={() => row.onSelect()}
    >
      {hasTicks ? (
        <span className="grid size-3.5 flex-none place-items-center">
          {row.checked === true && <Check className="text-accent-text" />}
        </span>
      ) : (
        row.icon
      )}
      <span>{row.label}</span>
    </Menu.Item>
  );
}
