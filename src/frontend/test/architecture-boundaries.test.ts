import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const COMPONENT_ROOTS = [join(ROOT, "components"), join(ROOT, "pages")];

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = COMPONENT_ROOTS.flatMap(filesUnder);
const nameOf = (file: string): string => relative(ROOT, file).replaceAll("\\", "/");
const codeOf = (file: string): string => readFileSync(file, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

function violations(pattern: RegExp, allowed: ReadonlySet<string> = new Set()): string[] {
  return files.flatMap((file) => {
    const name = nameOf(file);
    return !allowed.has(name) && pattern.test(codeOf(file)) ? [name] : [];
  });
}

describe("frontend architecture boundaries", () => {
  it("keeps request and device ownership out of components and pages", () => {
    assert.deepEqual(violations(/from\s+["']@\/services(?:\/|["'])|\bfetch\s*\(|\b(?:local|session)Storage\b|\bindexedDB\b/), []);
  });

  it("keeps global listeners and device controllers in focused hooks", () => {
    assert.deepEqual(violations(/\.addEventListener\s*\(|\.removeEventListener\s*\(|new\s+\w+(?:Controller|Observer|Player)\s*\(/), []);
  });

  it("allows only the documented auth wall and Spotlight custom overlay surfaces", () => {
    const authWall = new Set(["components/gate/GateWall.tsx"]);
    const spotlight = new Set(["components/library/SpotlightCatcher.tsx"]);
    assert.deepEqual(violations(/role=["']dialog["']|aria-modal=["']true["']/, authWall), []);
    assert.deepEqual(violations(/className=["'][^"']*fixed\s+inset-0[^"']*(?:bg-scrim|backdrop)/, spotlight), []);
  });

  it("rejects disabled-title and title-wrapper tooltip bypasses", () => {
    const failures: string[] = [];
    for (const file of files) {
      const code = codeOf(file);
      for (const match of code.matchAll(/<(button|Button|IconButton)\b[^>]*>/gs)) {
        const tag = match[0];
        if (/\bdisabled\s*=/.test(tag) && /\btitle\s*=/.test(tag) && !/\breason\s*=/.test(tag)) {
          failures.push(`${nameOf(file)}: disabled ${match[1]} uses title without reason`);
        }
      }
      if (/<span\b[^>]*\btitle\s*=[^>]*>\s*<(?:Button|IconButton)\b/gs.test(code)) {
        failures.push(`${nameOf(file)}: title wrapper surrounds a shared control`);
      }
    }
    assert.deepEqual(failures, []);
  });
});
