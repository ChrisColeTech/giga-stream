import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { measure } from "../rules/size-and-naming.mjs";
import { runChecks } from "../run-checks.mjs";
import { stripNoise } from "../strip-noise.mjs";

/** A throwaway repository tree: `{ "src/backend/src/app.ts": "..." }`. */
function tree(entries) {
  const root = mkdtempSync(path.join(os.tmpdir(), "rules-"));
  for (const [rel, content] of Object.entries(entries)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

function violations(entries, options = {}) {
  return runChecks({ root: tree(entries), ...options }).findings;
}

const CLEAN = {
  "src/backend/src/app.ts": 'export const a = 1;\n',
  "src/backend/package.json": '{"dependencies":{"fastify":"^5.0.0"}}',
};

test("a clean tree has no violations", () => {
  assert.deepEqual(violations(CLEAN), []);
});

test("measure wraps long lines at 120 columns", () => {
  assert.equal(measure("a\n" + "x".repeat(121) + "\n"), 3);
  assert.equal(measure("\n\n"), 2);
});

test("a file over the ceiling is reported, a test file gets 250", () => {
  const long = "export const x = 1;\n".repeat(201);
  assert.equal(violations({ "src/backend/src/long.ts": long }).filter((f) => f.rule === "size-and-naming").length, 1);
  assert.deepEqual(violations({ "src/backend/test/long.test.ts": long }), []);
});

test("file names must be kebab-case and grab-bag names are refused", () => {
  const names = violations({
    "src/backend/src/badName.ts": "export const a = 1;\n",
    "src/backend/src/utils.ts": "export const b = 1;\n",
    "src/backend/src/helpers/thing.ts": "export const c = 1;\n",
  }).map((f) => f.message);
  assert.ok(names.some((m) => m.includes("kebab-case")));
  assert.ok(names.some((m) => m.includes("grab-bag")));
  assert.equal(names.filter((m) => m.includes("grab-bag")).length, 2);
});

test("any, ts-ignore and double assertions are refused; mentions in comments and strings are not", () => {
  const bad = violations({
    "src/backend/src/a.ts": "export const f = (x: any) => x;\nconst y = z as unknown as string;\n// @ts-ignore\n",
  });
  assert.equal(bad.filter((f) => f.rule === "banned-code").length, 3);
  const fine = violations({
    "src/backend/src/b.ts": '// any value\nexport const s = "any";\nexport const r = /["\'`]any/;\n',
  });
  assert.deepEqual(fine, []);
});

test("a program cannot import another program's source", () => {
  const found = violations({
    "src/fileserver/src/a.ts": 'import { x } from "../../backend/src/app.js";\n',
  });
  assert.equal(found.filter((f) => f.rule === "import-boundaries").length, 1);
});

test("electron only in the main-process folder; node:sqlite only under store/", () => {
  const found = violations({
    "src/fileserver/src/services/a.ts": 'import { app } from "electron";\nimport { DatabaseSync } from "node:sqlite";\n',
    "src/fileserver/src/app/ok.ts": 'import { app } from "electron";\n',
    "src/fileserver/src/store/ok.ts": 'import { DatabaseSync } from "node:sqlite";\n',
  });
  assert.equal(found.filter((f) => f.rule === "import-boundaries").length, 2);
});

test("routes may not do file, process or store work", () => {
  const found = violations({
    "src/fileserver/src/routes/a.ts": 'import fs from "node:fs";\nimport { db } from "../store/database.js";\n',
  });
  assert.equal(found.filter((f) => f.rule === "import-boundaries").length, 2);
});

test("routes must begin /api except /healthz and /ws; SQL belongs in store/", () => {
  const found = violations({
    "src/backend/src/api/a.ts": 'app.get("/things", h);\napp.get("/healthz", h);\napp.get("/ws", h);\napp.get("/api/ok", h);\n',
    "src/backend/src/services/b.ts": 'export const q = "SELECT id FROM titles";\n',
    "src/backend/src/store/c.ts": 'export const q = "SELECT id FROM titles";\n',
  });
  const routes = found.filter((f) => f.message.includes("must begin /api"));
  assert.equal(routes.length, 1);
  assert.equal(found.filter((f) => f.message.includes("SQL belongs")).length, 1);
});

test("the backend's stream plugins and admin app are the only other root routes, each in its one file", () => {
  const found = violations({
    "src/backend/src/api/live-streams.ts":
      'x.register(p, { prefix: "/live" });\nx.register(p, { prefix: "/logos" });\nx.register(p, { prefix: "/nope" });\n' +
      'app.get("/test/player.html", h);\napp.get("/live/a", h);\napp.get("/other", h);\n',
    "src/backend/src/api/admin-static.ts": 'app.get("/admin", h);\napp.get("/admin/*", h);\napp.get("/live/a", h);\n',
    "src/backend/src/api/other.ts": 'app.get("/admin/x", h);\nx.register(p, { prefix: "/live" });\n',
  });
  const routes = found.filter((f) => f.message.includes("must begin /api"));
  assert.deepEqual(routes.map((f) => `${f.file}:${f.line}`).sort(), [
    "src/backend/src/api/admin-static.ts:3",
    "src/backend/src/api/live-streams.ts:3",
    "src/backend/src/api/live-streams.ts:6",
    "src/backend/src/api/other.ts:1",
    "src/backend/src/api/other.ts:2",
  ]);
});

test("the renderer may not fetch outside services, store to browser storage or build a second socket", () => {
  const found = violations({
    "src/frontend/src/services/api.ts": "export const g = () => fetch('/api/x');\n",
    "src/frontend/src/hooks/useThing.ts": "export const g = () => fetch('/api/x');\nlocalStorage.setItem('a','b');\nnew WebSocket('/ws');\n",
  });
  assert.equal(found.filter((f) => f.rule === "transport-and-routes").length, 3);
});

test("the renderer contains no admin-backend or metadata-service address", () => {
  const found = violations({
    "src/frontend/src/services/api.ts":
      "export const a = 'http://127.0.0.1:3001/api';\nexport const b = () => fetch(adminUrl);\n",
    "src/frontend/src/types/settings.ts": "export interface Settings { adminUrl: string }\n",
  }).filter((finding) => finding.rule === "frontend-fileserver-only");
  assert.equal(found.length, 2);
});

test("one component per file, named for the file; named exports only", () => {
  const found = violations({
    "src/frontend/src/components/live/ChannelRow.tsx": "export function ChannelRow() {}\nexport function Other() {}\n",
    "src/frontend/src/components/live/Wrong.tsx": "export function Different() {}\n",
    "src/frontend/src/components/live/Fine.tsx": "export function Fine() {}\n",
    "src/frontend/src/lib/thing.ts": "export default 1;\n",
    "src/frontend/src/pages/LivePage.tsx": "export default function LivePage() {}\n",
  }).filter((f) => f.rule === "frontend-structure");
  // two components, a misnamed one, a default export in lib, and the page's default export (counted twice)
  assert.equal(found.length, 5);
});

test("a surface file sets no arbitrary pixel text size; the family ui layer and comments may", () => {
  const found = violations({
    "src/frontend/src/components/live/Note.tsx": 'export function Note() { return <p className="text-[13px]" />; }\n',
    "src/frontend/src/components/live/Fine.tsx":
      '// text-[13px] in a comment\nexport function Fine() { return <p className="text-sm" />; }\n',
    "src/frontend/src/components/ui/Field.tsx": 'export function Field() { return <p className="text-[13px]" />; }\n',
  }).filter((f) => f.rule === "type-scale");
  assert.equal(found.length, 1);
  assert.equal(found[0].file, "src/frontend/src/components/live/Note.tsx");
});

test("the admin backend is held to one component per file and the type scale", () => {
  const found = violations({
    "src/backend/src/admin/AccountsScreen.tsx":
      'export function AccountsScreen() { return <p className="text-[13px]" />; }\nexport function Extra() {}\n',
    "src/backend/src/admin/AuditScreen.tsx": 'export function AuditScreen() { return <p className="text-sm" />; }\n',
  });
  assert.equal(found.filter((f) => f.rule === "frontend-structure" && f.message.includes("one per file")).length, 1);
  const scale = found.filter((f) => f.rule === "type-scale");
  assert.equal(scale.length, 1);
  assert.equal(scale[0].file, "src/backend/src/admin/AccountsScreen.tsx");
});

test("--skip leaves a program out entirely", () => {
  const entries = {
    "src/frontend/src/a.ts": "export const x: any = 1;\n",
  };
  assert.ok(violations(entries).length >= 1);
  assert.deepEqual(violations(entries, { skip: ["frontend"] }), []);
});

test("stripNoise keeps line numbers and survives an apostrophe inside a regex", () => {
  const out = stripNoise("const r = /['\"]/;\n// note\nconst a = 1;\n", { strings: false });
  assert.equal(out.split("\n").length, 4);
  assert.ok(out.includes("const a = 1;"));
});
