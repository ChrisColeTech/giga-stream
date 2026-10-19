/**
 * The Windows app (`npm run dist:win` at the root; docs/07 section 6): the fileserver and its Electron shell,
 * nothing else. The admin backend is a separate program and never ships in it.
 *
 * What ships, and why each path lands where it does — the compiled code resolves every one of them
 * relative to itself, so nothing in the fileserver knows it is packaged:
 *
 * - `src/fileserver` is the app (its own package.json, `main` and production `dependencies`) in app.asar.
 * - The built interface goes to resources/frontend/dist: config.ts resolves `../frontend/dist` from the
 *   app root, which packaged is resources/app.asar.
 * - The shared media library goes to resources/shared/media: the fileserver imports
 *   `../../../shared/media/dist` from app.asar/dist/<folder>. Its package.json goes too, for `type: module`.
 * - FFmpeg goes beside the exe in tools/ffmpeg/win32-x64/bin: locate-tool.ts resolves the repository root five
 *   folders above itself, which packaged is the install folder.
 *
 * The packaged app runs as production (src/app/production-env.ts), on its own ports (docs/03 section 1).
 */
const path = require("node:path");

const electronVersion = require(path.join(__dirname, "../src/fileserver/node_modules/electron/package.json")).version;

module.exports = {
  appId: "com.giga.stream",
  productName: "Giga Stream",
  electronVersion,
  directories: {
    app: "src/fileserver",
    output: "release",
  },
  files: ["dist/**", "package.json"],
  extraResources: [
    { from: "src/frontend/dist", to: "frontend/dist" },
    { from: "src/shared/media/dist", to: "shared/media/dist" },
    { from: "src/shared/media/package.json", to: "shared/media/package.json" },
  ],
  extraFiles: [
    { from: "tools/ffmpeg/win32-x64/bin", to: "tools/ffmpeg/win32-x64/bin", filter: ["*.exe", "*.dll"] },
    { from: "tools/ffmpeg", to: "licenses/ffmpeg", filter: ["COPYING.*", "SOURCE.md"] },
  ],
  // No native modules (node:sqlite is built into Electron's Node), so nothing to rebuild.
  npmRebuild: false,
  win: {
    target: "nsis",
    // Unsigned: SmartScreen warns on first run until a code-signing certificate is wired in.
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    deleteAppDataOnUninstall: false,
  },
};
