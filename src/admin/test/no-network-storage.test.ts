import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/* Wave 2 draws the admin from fixtures: no request, no browser storage, no timer, no polling (`01` section 4.4). A
 * source scan, because a component test cannot see a call that is never made. `29` replaces this with its own
 * no-storage test when the request layer lands. */
const SRC = fileURLToPath(new URL("../src", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? files(join(dir, item.name)) : /\.(ts|tsx)$/.test(item.name) ? [join(dir, item.name)] : [],
  );
}

const SOURCES = files(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

function offenders(pattern: RegExp): string[] {
  return SOURCES.filter((source) => pattern.test(source.text)).map((source) => source.path.slice(SRC.length));
}

describe("the admin's source", () => {
  it("finds the files it scans", () => {
    assert.ok(SOURCES.length > 50, `${SOURCES.length} files`);
  });

  it("calls fetch in services/api.ts only, and uses no XMLHttpRequest, WebSocket, EventSource or beacon", () => {
    const calls = offenders(/\bfetch\s*\(/).map((path) => path.replaceAll("\\", "/"));
    assert.deepEqual(calls, ["/services/api.ts"]);
    assert.deepEqual(offenders(/XMLHttpRequest|new WebSocket|new EventSource|sendBeacon/), []);
  });

  it("touches no browser storage or cookie", () => {
    assert.deepEqual(offenders(/localStorage|sessionStorage|indexedDB|document\.cookie|caches\./), []);
  });

  it("runs no timer and no poll", () => {
    assert.deepEqual(offenders(/\bsetInterval\b|\bsetTimeout\b|requestIdleCallback/), []);
  });

  it("imports nothing the removed demo left behind, and no dropdown menu", () => {
    assert.deepEqual(offenders(/@radix-ui\/react-dropdown-menu|@\/services\/not-connected|@\/fixtures\/(channels|titles|jobs|player|collections)/), []);
  });

  it("uses no placeholder text, no aria-disabled and no browser dialog", () => {
    assert.deepEqual(offenders(/\bplaceholder\s*=/), []);
    assert.deepEqual(offenders(/aria-disabled/), []);
    assert.deepEqual(offenders(/\b(alert|confirm|prompt)\s*\(/), []);
  });
});
