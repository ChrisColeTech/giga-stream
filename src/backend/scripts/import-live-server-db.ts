// One-shot import of an existing live server database into the admin backend (docs/26 decision D13).
//
//   npm run import:live-server -- <path to live-server.db> [--data-dir <backend data folder>] [--dry-run]
//
// Each channel of the old database becomes a `kind: live` row (same id, name, category, number, mode,
// captions, qualities and source). It is idempotent: a channel already in the backend is skipped, as is one
// whose number a live row already holds. `--dry-run` reads both databases and writes nothing. The target is
// `--data-dir`, else the backend's own `DATA_DIR` (default ~/.giga-stream-admin); stop the backend first.
// The server never runs this; the owner does.
import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "../src/config.js";
import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { runLiveServerImport } from "../src/services/live-server-import-service.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const valueOf = (flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
};
const source = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--data-dir");

if (!source) {
  console.error("usage: import-live-server-db <path to live-server.db> [--data-dir <folder>] [--dry-run]");
  process.exit(2);
}
if (!existsSync(source)) {
  console.error(`${source} does not exist.`);
  process.exit(2);
}

const target = path.join(path.resolve(valueOf("--data-dir") ?? config.DATA_DIR), DATABASE_FILE_NAME);
const summary = runLiveServerImport({ source: path.resolve(source), target, dryRun, now: Date.now });
const verb = summary.dryRun ? "would import" : "imported";
for (const id of summary.inserted) console.log(`${verb}  ${id}`);
for (const skip of summary.skipped) console.log(`skipped   ${skip.id}  (${skip.reason})`);
console.log(`${summary.dryRun ? "dry run: " : ""}${summary.inserted.length} ${verb}, ${summary.skipped.length} skipped -> ${target}`);
