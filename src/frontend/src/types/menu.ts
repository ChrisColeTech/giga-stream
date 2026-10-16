import type { ReactNode } from "react";

/** One row of a context menu. A row is an action, a submenu, a separator, or a heading, never two of those at once. */
export type MenuItem =
  | { kind: "separator" }
  | { kind: "heading"; label: string }
  | {
      kind: "action";
      label: string;
      icon?: ReactNode;
      /** Present (true or false) reserves the tick slot, so labels do not shift as membership toggles. Absent means
       *  no tick column at all. */
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      /** A disabled row says WHY, on the control itself. */
      disabledReason?: string;
      onSelect: () => void;
    }
  | {
      /** A row that opens a panel of its own (`06` section 4.5, `Collections ▸`). ONE level deep, deliberately. */
      kind: "submenu";
      label: string;
      icon?: ReactNode;
      items: MenuRow[];
    };

/** A row that may appear inside a submenu: everything but another submenu. */
export type MenuRow = Exclude<MenuItem, { kind: "submenu" }>;

/** Where the menu was summoned from, in viewport coordinates. */
export interface MenuAnchor {
  x: number;
  y: number;
}
