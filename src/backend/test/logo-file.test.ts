// The cache writer (docs/43 section 3.1) under forced races: identical bytes written by many writers at once are one
// file, every write succeeds, no temp file is left, and an existing file is never rewritten.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "./db-kit.js";
import test from "node:test";

import { writeCacheFile } from "../src/services/logo-file.js";

const nameOf = (bytes: Buffer): string => `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.png`;
const payload = (n: number): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from(`body-${n}`)]);

function scratch(): { dir: string; done: () => void } {
  const root = mkdtempSync(path.join(os.tmpdir(), "logo-file-"));
  return { dir: path.join(root, "logo-cache"), done: () => removeDir(root) };
}

test("two concurrent writes of identical bytes both succeed and leave one file and no temp file", async () => {
  const { dir, done } = scratch();
  try {
    const bytes = payload(1);
    const results = await Promise.allSettled([writeCacheFile(dir, nameOf(bytes), bytes), writeCacheFile(dir, nameOf(bytes), bytes)]);
    assert.deepEqual(results.map((r) => r.status), ["fulfilled", "fulfilled"]);
    assert.deepEqual(readdirSync(dir), [nameOf(bytes)]);
    assert.equal(readFileSync(path.join(dir, nameOf(bytes))).equals(bytes), true);
  } finally {
    done();
  }
});

test("fifty concurrent writes of a few distinct payloads: every write succeeds, one file per payload, nothing left over", async () => {
  const { dir, done } = scratch();
  try {
    const bodies = [payload(1), payload(2), payload(3), payload(4)];
    const writes = Array.from({ length: 50 }, (_, i) => {
      const bytes = bodies[i % bodies.length] ?? payload(0);
      return writeCacheFile(dir, nameOf(bytes), bytes);
    });
    const results = await Promise.allSettled(writes);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 50, "no write is counted as failed");
    assert.deepEqual(readdirSync(dir).sort(), bodies.map(nameOf).sort());
    for (const bytes of bodies) assert.equal(readFileSync(path.join(dir, nameOf(bytes))).equals(bytes), true);
  } finally {
    done();
  }
});

test("an existing file is success and is not rewritten", async () => {
  const { dir, done } = scratch();
  try {
    const bytes = payload(7);
    await writeCacheFile(dir, nameOf(bytes), bytes);
    const file = path.join(dir, nameOf(bytes));
    const before = statSync(file, { bigint: true }).mtimeNs;
    await writeCacheFile(dir, nameOf(bytes), bytes);
    assert.equal(statSync(file, { bigint: true }).mtimeNs, before);
    assert.deepEqual(readdirSync(dir), [nameOf(bytes)]);
  } finally {
    done();
  }
});
