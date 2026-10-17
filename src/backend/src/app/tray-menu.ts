/** The tray's wording and menu order, pure so a plain node test can pin them. */
export const TRAY_TITLE = "Giga Stream Admin";

export type TrayAction = "open" | "quit";
export interface TrayMenuItem {
  readonly action: TrayAction;
  readonly label: string;
}

/** The tray's context menu, in order: exactly these two entries. */
export function trayMenuModel(): readonly TrayMenuItem[] {
  return [
    { action: "open", label: `Open ${TRAY_TITLE}` },
    { action: "quit", label: "Quit" },
  ];
}

/** The tooltip: the app's name and the address the backend answers on. */
export function trayTooltip(address: string): string {
  return `${TRAY_TITLE} - ${address}`;
}
