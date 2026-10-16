import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARM_TIMEOUT_MS, nextTwoStep } from "@/lib/collections-two-step";

describe("the Remove collection two-step", () => {
  it("a press arms the idle control", () => {
    assert.equal(nextTwoStep("press"), "armed");
  });

  it("a timeout, focus leaving or Escape each disarms it", () => {
    assert.equal(nextTwoStep("timeout"), "idle");
    assert.equal(nextTwoStep("blur"), "idle");
    assert.equal(nextTwoStep("escape"), "idle");
  });

  it("the armed state waits a few seconds, not indefinitely", () => {
    assert.ok(ARM_TIMEOUT_MS >= 3000 && ARM_TIMEOUT_MS <= 10000);
  });
});
