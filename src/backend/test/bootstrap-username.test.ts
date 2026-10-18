// The first admin's username comes from ADMIN_BOOTSTRAP_USERNAME, or from the old ADMIN_BOOTSTRAP_EMAIL when only
// that is set. Plain objects stand in for the environment: no real file or variable is read.
import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapUsername } from "../src/bootstrap-username.js";
import { makeApp, signIn } from "./test-app.js";

test("the new name wins; the old name is the fallback; neither is empty", () => {
  assert.equal(bootstrapUsername({ ADMIN_BOOTSTRAP_USERNAME: "boss", ADMIN_BOOTSTRAP_EMAIL: "old@example.test" }), "boss");
  assert.equal(bootstrapUsername({ ADMIN_BOOTSTRAP_USERNAME: "", ADMIN_BOOTSTRAP_EMAIL: "old@example.test" }), "old@example.test");
  assert.equal(bootstrapUsername({ ADMIN_BOOTSTRAP_EMAIL: "  old@example.test " }), "old@example.test");
  assert.equal(bootstrapUsername({ ADMIN_BOOTSTRAP_USERNAME: "  boss  " }), "boss");
  assert.equal(bootstrapUsername({}), "");
});

test("a backend with only the old variable set creates its admin under that name", async () => {
  const t = await makeApp({ config: { ADMIN_BOOTSTRAP_USERNAME: "", ADMIN_BOOTSTRAP_EMAIL: "owner@example.test" } });
  assert.equal((await signIn(t.app, "OWNER@example.test")).access.length > 0, true);
});

test("a bootstrap username that is not valid stops the start, naming the variable", async () => {
  await assert.rejects(
    makeApp({ config: { ADMIN_BOOTSTRAP_USERNAME: "u".repeat(255) } }),
    /ADMIN_BOOTSTRAP_USERNAME is not valid/,
  );
});
