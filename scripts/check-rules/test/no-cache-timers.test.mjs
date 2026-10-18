import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { runChecks } from "../run-checks.mjs";

/** A throwaway repository tree: `{ "src/fileserver/src/services/a.ts": "..." }`. */
function tree(entries) {
  const root = mkdtempSync(path.join(os.tmpdir(), "timers-"));
  for (const [rel, content] of Object.entries(entries)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

function found(entries) {
  return runChecks({ root: tree(entries), only: "no-cache-timers" }).findings;
}

test("a timer in the fileserver's services, store, routes or lib is refused", () => {
  const hits = found({
    "src/fileserver/src/services/a.ts": "export const a = setInterval(() => 1, 5);\n",
    "src/fileserver/src/store/b.ts": "export const b = setTimeout(() => 1, 5);\n",
    "src/fileserver/src/routes/c.ts": "export const c = setImmediate(() => 1);\n",
    "src/fileserver/src/lib/d.ts": "import { setTimeout as wait } from 'node:timers/promises';\nawait wait(1);\nsetTimeout(wait, 1);\n",
  });
  assert.deepEqual(
    hits.map((hit) => hit.file).sort(),
    [
      "src/fileserver/src/lib/d.ts",
      "src/fileserver/src/lib/d.ts",
      "src/fileserver/src/routes/c.ts",
      "src/fileserver/src/services/a.ts",
      "src/fileserver/src/store/b.ts",
    ],
  );
  assert.equal(hits[0]?.rule, "no-cache-timers");
});

test("the request deadline, comments, strings and other folders are not timers", () => {
  assert.deepEqual(
    found({
      "src/fileserver/src/services/ok.ts":
        "// no setInterval here\nexport const s = AbortSignal.timeout(5);\nexport const t = 'setTimeout';\n",
      "src/fileserver/src/app/main.ts": "export const w = setTimeout(() => 1, 5);\n",
      "src/backend/src/services/other.ts": "export const x = setInterval(() => 1, 5);\n",
      "src/fileserver/test/timer.test.ts": "export const y = setTimeout(() => 1, 5);\n",
    }),
    [],
  );
});
