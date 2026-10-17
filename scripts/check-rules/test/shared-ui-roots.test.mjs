import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadFiles } from "../load-files.mjs";
import { runChecks } from "../run-checks.mjs";

/** A throwaway repository tree: `{ "src/shared/ui/src/a.ts": "..." }`. */
function tree(entries) {
  const root = mkdtempSync(path.join(os.tmpdir(), "roots-"));
  for (const [rel, content] of Object.entries(entries)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

function findings(entries, rule) {
  return runChecks({ root: tree(entries) }).findings.filter((f) => f.rule === rule);
}

test("the admin app, the family library and the request layer are program roots of their own", () => {
  const root = tree({
    "src/admin/src/main.tsx": "export {};\n",
    "src/shared/ui/src/controls/Button.tsx": "export function Button() { return null; }\n",
    "src/shared/http/src/api.ts": "export const a = 1;\n",
    "src/shared/media/src/index.ts": "export const m = 1;\n",
  });
  const programs = new Map(loadFiles(root).map((file) => [file.rel, file.program]));
  assert.equal(programs.get("src/admin/src/main.tsx"), "admin");
  assert.equal(programs.get("src/shared/ui/src/controls/Button.tsx"), "shared-ui");
  assert.equal(programs.get("src/shared/http/src/api.ts"), "shared-http");
  assert.equal(programs.get("src/shared/media/src/index.ts"), "shared");
});

test("a library file is claimed once, by its own root, never again by src/shared", () => {
  const root = tree({
    "src/shared/ui/src/controls/Button.tsx": "export function Button() { return null; }\n",
    "src/shared/ui/test/button.test.tsx": "export {};\n",
  });
  const files = loadFiles(root);
  assert.equal(files.filter((f) => f.rel.startsWith("src/shared/ui/")).length, 2);
  assert.ok(files.every((f) => !(f.rel.startsWith("src/shared/ui/") && f.program === "shared")));
});

test("library naming: components are PascalCase, hooks useThing, everything else kebab-case", () => {
  const names = findings(
    {
      "src/shared/ui/src/controls/button.tsx": "export function Button() { return null; }\n",
      "src/shared/ui/src/hooks/armed.ts": "export const a = 1;\n",
      "src/shared/ui/src/lib/Cn.ts": "export const c = 1;\n",
      "src/shared/ui/src/lib/label-column.ts": "export const l = 1;\n",
    },
    "size-and-naming",
  ).map((f) => f.message);
  assert.equal(names.filter((m) => m.includes("PascalCase")).length, 1);
  assert.equal(names.filter((m) => m.includes("useThing")).length, 1);
  assert.equal(names.filter((m) => m.includes("kebab-case")).length, 1);
});

test("the library holds one component per file, named for the file", () => {
  const found = findings(
    { "src/shared/ui/src/form/Row.tsx": "export function Row() { return null; }\nexport function Other() { return null; }\n" },
    "frontend-structure",
  );
  assert.equal(found.length, 1);
  assert.ok(found[0].message.includes("one per file"));
});

test("the library may not import a program", () => {
  const found = findings(
    { "src/shared/ui/src/x.ts": 'import { cn } from "../../../frontend/src/lib/cn";\nexport const y = cn;\n' },
    "import-boundaries",
  );
  assert.equal(found.length, 1);
  assert.ok(found[0].message.includes("may not import"));
});

test("the admin app may not import frontend source, and an app reaches the library by its alias only", () => {
  const found = findings(
    {
      "src/admin/src/a.ts": 'import { cn } from "../../frontend/src/lib/cn";\nexport const a = cn;\n',
      "src/frontend/src/components/Thing.tsx":
        'import { cn } from "../../../shared/ui/src/lib/cn";\nimport { cn as ok } from "@giga/ui/lib/cn";\nexport function Thing() { return ok("a", cn("b")); }\n',
    },
    "import-boundaries",
  );
  assert.equal(found.filter((f) => f.file === "src/admin/src/a.ts").length, 1);
  assert.equal(found.filter((f) => f.file === "src/frontend/src/components/Thing.tsx").length, 1);
});

test("the request layer is React-free and the only home of fetch in the libraries", () => {
  const react = findings({ "src/shared/http/src/api.ts": 'import { useState } from "react";\nexport const s = useState;\n' }, "import-boundaries");
  assert.equal(react.length, 1);
  const fetches = findings(
    {
      "src/shared/http/src/api.ts": "export const g = () => fetch('/api/x');\n",
      "src/shared/ui/src/lib/net.ts": "export const g = () => fetch('/api/x');\n",
    },
    "transport-and-routes",
  );
  assert.deepEqual(fetches.map((f) => f.file), ["src/shared/ui/src/lib/net.ts"]);
});

test("the admin's copies of the family files are exempt from the ceiling until their step deletes them", () => {
  const long = "export const x = 1;\n".repeat(201);
  assert.deepEqual(findings({ "src/admin/src/components/ui/Section.tsx": long }, "size-and-naming"), []);
  assert.equal(findings({ "src/admin/src/components/library/long-file.ts": long }, "size-and-naming").length, 1);
});

test("the admin's and the library's surfaces get the colour, scale and transport bans", () => {
  const found = runChecks({
    root: tree({
      "src/admin/src/components/x/Y.tsx": "export function Y() { return <i style={{ color: '#ffffff' }} className=\"text-[13px]\" />; }\n",
      "src/shared/ui/src/controls/Z.tsx": "export function Z() { return <i style={{ color: '#ffffff' }} />; }\n",
    }),
  }).findings;
  assert.ok(found.some((f) => f.file === "src/admin/src/components/x/Y.tsx" && f.message.includes("raw colour")));
  assert.ok(found.some((f) => f.file === "src/admin/src/components/x/Y.tsx" && f.message.includes("off the type scale")));
  assert.ok(found.some((f) => f.file === "src/shared/ui/src/controls/Z.tsx" && f.message.includes("raw colour")));
});
