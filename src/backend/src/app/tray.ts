import { Menu, nativeImage, Tray } from "electron";

import { buildIconPng } from "./tray-icon.js";
import { trayMenuModel, trayTooltip, type TrayAction } from "./tray-menu.js";

export interface TrayCallbacks {
  /** Shows and focuses the window (restoring it when minimised). */
  readonly showWindow: () => void;
  /** Quits the app, which stops the backend this process started. */
  readonly quit: () => void;
  /** The backend's address, shown in the tooltip. */
  readonly address: string;
}

export interface TrayHandle {
  /** Removes the icon; safe to call twice. An icon left behind lingers as a ghost on Windows. */
  destroy(): void;
}

/**
 * The system tray icon (docs/26 section 4.1): a click or double click shows the window, the menu offers Open and
 * Quit. The icon is generated in code (`tray-icon.ts`); 32px at scale 2 is a crisp 16 DIP.
 */
export function createTray({ showWindow, quit, address }: TrayCallbacks): TrayHandle {
  const tray = new Tray(nativeImage.createFromBuffer(buildIconPng(), { scaleFactor: 2 }));
  tray.setToolTip(trayTooltip(address));
  const run: Record<TrayAction, () => void> = { open: showWindow, quit };
  const template = trayMenuModel().map((item) => ({ label: item.label, click: run[item.action] }));
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.on("click", showWindow);
  tray.on("double-click", showWindow);
  return {
    destroy: () => {
      if (!tray.isDestroyed()) tray.destroy();
    },
  };
}
