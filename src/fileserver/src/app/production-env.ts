import { app } from "electron";

/**
 * Imported FIRST by main.ts, before anything that loads config.ts: ES modules evaluate in import order,
 * so this runs before the environment is parsed. The packaged app is production — its own ports
 * (docs/03 section 1), so the installed exe and the development stack run side by side. An explicit
 * `NODE_ENV` still wins.
 */
if (app.isPackaged) process.env.NODE_ENV ??= "production";
