import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runChecks } from "../run-checks.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DEDUPE = "['react', 'react-dom', 'framer-motion', 'zustand', 'lucide-react']";

/** A throwaway repository tree: `{ "src/shared/ui/package.json": "..." }`. */
function tree(entries) {
  const root = mkdtempSync(path.join(os.tmpdir(), "consume-"));
  for (const [rel, content] of Object.entries(entries)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const LIBRARY_PKG = JSON.stringify({ dependencies: { react: "^19.2.8", "react-dom": "^19.2.8" } });

/** One consumer that passes the rule; `drop` removes one of the four required pieces to make it fail. */
function consumer(dir, { drop = "", pin = "^19.2.8" } = {}) {
  const alias = drop === "alias" ? "" : "'@giga/ui': x, '@giga/http': y,";
  const dedupe = drop === "dedupe" ? "" : `dedupe: ${DEDUPE},`;
  const fsAllow = drop === "fs" ? "" : "server: { fs: { allow: ['../..'] } },";
  const source = drop === "source" ? "" : '@source "../../shared/ui/src";';
  const paths =
    drop === "paths"
      ? '"paths": { "@/*": ["./src/*"] }'
      : '"paths": { "@/*": ["./src/*"], "@giga/ui/*": ["../shared/ui/src/*"], "@giga/http/*": ["../shared/http/src/*"] }';
  return {
    [`${dir}/vite.config.mts`]: `export default { resolve: { alias: { ${alias} }, ${dedupe} }, ${fsAllow} };\n`,
    [`${dir}/src/index.css`]: `@import "tailwindcss";\n${source}\n`,
    [`${dir}/tsconfig.app.json`]: `{ "compilerOptions": { ${paths} } }\n`,
    [`${dir}/package.json`]: JSON.stringify({ dependencies: { react: pin, "react-dom": "^19.2.8" } }),
  };
}

function problems(entries) {
  return runChecks({ root: tree(entries) }).findings.filter((f) => f.rule === "shared-ui-consumption");
}

function both(options = {}) {
  return {
    "src/shared/ui/package.json": LIBRARY_PKG,
    ...consumer("src/frontend", options),
    ...consumer("src/admin", options),
  };
}

test("no library in the tree means nothing to check", () => {
  assert.deepEqual(problems({ "src/backend/src/app.ts": "export const a = 1;\n" }), []);
});

test("both consumers complete: no findings", () => {
  assert.deepEqual(problems(both()), []);
});

test("a consumer missing the alias, the @source, the dedupe, fs.allow or the paths fails, against that consumer", () => {
  // The admin is complete in every tree here, so a finding can only come from the consumer that was dropped from.
  for (const drop of ["alias", "source", "dedupe", "fs", "paths"]) {
    const found = problems({ "src/shared/ui/package.json": LIBRARY_PKG, ...consumer("src/frontend", { drop }), ...consumer("src/admin") });
    assert.ok(found.length > 0, `dropping ${drop} must fail`);
    assert.ok(found.every((f) => f.file === "src/frontend"), `dropping ${drop} reported ${JSON.stringify(found.map((f) => f.file))}`);
  }
});

test("a tree whose admin consumer is absent reports the admin, not the frontend", () => {
  const found = problems({ "src/shared/ui/package.json": LIBRARY_PKG, ...consumer("src/frontend") });
  assert.ok(found.length > 0);
  assert.ok(found.every((f) => f.file === "src/admin"));
});

test("a version drift between a consumer and the library fails", () => {
  const found = problems(both({ pin: "^19.3.0" }));
  assert.equal(found.length, 2);
  assert.ok(found.every((f) => f.message.includes("react is ^19.3.0")));
});

test("the real apps pass the consumption rule", () => {
  const found = runChecks({ root: REPO }).findings.filter((f) => f.rule === "shared-ui-consumption");
  assert.deepEqual(found, []);
});
