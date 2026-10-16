/** The fileserver's identity (docs/03 sections 1 and 3.1). */
export const APP_VERSION = "0.2.0";

/** The runtime the renderer runs in: Electron's main process or a plain browser session. */
export const APP_RUNTIME: "electron" | "browser" =
  typeof process !== "undefined" && process.versions?.electron !== undefined ? "electron" : "browser";

/** `GET /healthz` reports this role. */
export const APP_ROLE = "fileserver";
