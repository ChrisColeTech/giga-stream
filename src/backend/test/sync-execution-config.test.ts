import assert from "node:assert/strict";
import test from "node:test";
import { EnvSchema } from "../src/config.js";

test("inline is the default; external and the worker's positive safe integer id are explicit", () => {
  assert.equal(EnvSchema.parse({}).SYNC_EXECUTION_MODE, "inline");
  assert.equal(EnvSchema.parse({}).SYNC_JOB_ID, undefined);
  assert.equal(EnvSchema.parse({ SYNC_EXECUTION_MODE: "external", SYNC_JOB_ID: "6" }).SYNC_JOB_ID, 6);
  assert.equal(EnvSchema.parse({ SYNC_JOB_ID: "7" }).SYNC_JOB_ID, 7);
  assert.equal(EnvSchema.safeParse({ SYNC_EXECUTION_MODE: "remote" }).success, false);
  for (const id of ["", "0", "-1", "1.5", "no", "Infinity", "9007199254740992"]) {
    assert.equal(EnvSchema.safeParse({ SYNC_JOB_ID: id }).success, false, id);
  }
});
