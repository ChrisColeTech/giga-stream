import path from "node:path";

import { app } from "electron";

/**
 * Imported FIRST by main.ts, before anything that loads config.ts: ES modules evaluate in import order, so this runs
 * before the environment is parsed. `electron .` cannot take Node's `--env-file`, so it does what `npm run dev` and
 * `npm start` do with their flags: development reads `.env` over `dev.env`, production (`--production`, or the packaged
 * app) reads `production.env` over `.env`. `loadEnvFile` never replaces a variable that is already set, so the file
 * loaded first wins, and a real environment variable beats both.
 */
const PRODUCTION = app.isPackaged || process.argv.includes("--production");
const ROOT = app.isPackaged ? app.getAppPath() : path.resolve(import.meta.dirname, "..", "..");

function load(file: string): void {
  try {
    process.loadEnvFile(path.join(ROOT, file));
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (!missing) throw error;
  }
}

if (PRODUCTION) {
  load("production.env");
  load(".env");
} else {
  load(".env");
  load("dev.env");
}
