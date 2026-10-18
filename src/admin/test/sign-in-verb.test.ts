import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GATE_START, type GateState } from "@/lib/gate-state";
import { signInReason } from "@/lib/sign-in-verb";

const SUBMITTING: GateState = { phase: "submitting" };

describe("the Sign in verb's reasons", () => {
  it("both fields empty: Enter your username and password.", () => {
    assert.equal(signInReason("", "", GATE_START), "Enter your username and password.");
  });

  it("a blank username counts as empty; the password is never trimmed", () => {
    assert.equal(signInReason("   ", "", GATE_START), "Enter your username and password.");
    assert.equal(signInReason("   ", "x", GATE_START), "Enter your username.");
    assert.equal(signInReason("a@b.test", " ", GATE_START), undefined);
  });

  it("names the one field that is missing", () => {
    assert.equal(signInReason("a@b.test", "", GATE_START), "Enter your password.");
    assert.equal(signInReason("", "secret", GATE_START), "Enter your username.");
  });

  it("is enabled with both filled", () => {
    assert.equal(signInReason("a@b.test", "secret", GATE_START), undefined);
  });

  it("waits while the port answers, whatever the fields hold", () => {
    assert.equal(signInReason("a@b.test", "secret", SUBMITTING), "Waiting for the answer.");
    assert.equal(signInReason("", "", SUBMITTING), "Waiting for the answer.");
  });

  it("stays enabled after a refusal, a lock or an unreachable backend: pressing it is the retry", () => {
    for (const phase of ["refused", "locked", "unreachable"] as const) {
      assert.equal(signInReason("a@b.test", "secret", { phase, sentence: "x" }), undefined, phase);
    }
  });
});
