import type { IpcSender } from "./trust.js";

export const CHOOSE_FOLDER_CHANNEL = "admin:choose-folder";

type DialogIpc = {
  handle: (channel: string, listener: (event: IpcSender, ...args: unknown[]) => unknown) => void;
};

/** What the picker needs of the window: `BrowserWindow` satisfies it, and a test passes a plain fake. */
export type DialogWindow = { isDestroyed: () => boolean };

/** `dialog.showOpenDialog(window, options)` reduced to what is read of it, so a test can supply the answer. */
export type OpenFolderDialog = (
  window: DialogWindow,
  options: { properties: ["openDirectory"]; title: string },
) => Promise<{ canceled: boolean; filePaths: string[] }>;

const FOLDER_TITLE = "Choose a folder";

/**
 * The native folder picker (docs/26 D18): the admin's `Choose` buttons ask the main process, which opens the
 * operating system's own dialog over the window and answers the first folder's path, or `null` when the person
 * cancels. A path on the backend's machine is exactly what a live channel's folder is, because the admin runs in
 * the backend's own window. No popup of the app's own and no directory-listing route exist.
 */
export function installNativeDialogIpc(
  ipc: DialogIpc,
  trusted: (event: IpcSender) => boolean,
  window: () => DialogWindow | null,
  open: OpenFolderDialog,
): void {
  ipc.handle(CHOOSE_FOLDER_CHANNEL, async (event, ...extra: unknown[]): Promise<string | null> => {
    if (!trusted(event)) throw new Error("The folder picker is available only to the app's own page.");
    if (extra.length !== 0) throw new TypeError("The folder picker takes no arguments.");
    const target = window();
    if (target === null || target.isDestroyed()) return null;
    const answer = await open(target, { properties: ["openDirectory"], title: FOLDER_TITLE });
    const chosen = answer.filePaths.at(0);
    return answer.canceled || chosen === undefined ? null : chosen;
  });
}
