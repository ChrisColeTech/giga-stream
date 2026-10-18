import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REFUSAL_SENTENCES, SESSION_ENDED_NOTICE } from "@/constants/sign-in-copy";
import { GATE_START, gateError, gateNotice, nextGate, phaseFor, type GateState } from "@/lib/gate-state";
import type { AuthResult, RefusalKind } from "@/types/auth";

const SUBMITTING: GateState = { phase: "submitting" };
const TOKENS = { accessToken: "a", accessExpiresAt: 1, refreshToken: "r", refreshExpiresAt: 2 };
const OK: AuthResult = { ok: true, session: { actor: { id: 7, username: "ada@example.test", name: "Ada" }, tokens: TOKENS } };
const refusal = (kind: RefusalKind): AuthResult => ({ ok: false, refusal: kind });

describe("the gate's state", () => {
  it("starts idle with nothing said", () => {
    assert.deepEqual(GATE_START, { phase: "idle", notice: null });
    assert.equal(gateError(GATE_START), null);
    assert.equal(gateNotice(GATE_START), null);
  });

  it("goes idle -> submitting on submit, and a second submit changes nothing", () => {
    const waiting = nextGate(GATE_START, { type: "submit" });
    assert.deepEqual(waiting, SUBMITTING);
    assert.equal(nextGate(waiting, { type: "submit" }), waiting);
  });

  it("a refused pair becomes `refused` with the table's sentence", () => {
    const next = nextGate(SUBMITTING, { type: "answer", result: refusal("invalid") });
    assert.deepEqual(next, { phase: "refused", sentence: "The username or password is wrong." });
    assert.equal(gateError(next), "The username or password is wrong.");
  });

  it("a lock and a rate limit are `locked`, each with its own sentence", () => {
    const locked = nextGate(SUBMITTING, { type: "answer", result: refusal("locked") });
    const limited = nextGate(SUBMITTING, { type: "answer", result: refusal("rate_limited") });
    assert.deepEqual(locked, { phase: "locked", sentence: REFUSAL_SENTENCES.locked });
    assert.deepEqual(limited, { phase: "locked", sentence: "Too many sign-in attempts; wait a minute." });
  });

  it("an unreachable backend is `unreachable`", () => {
    const next = nextGate(SUBMITTING, { type: "answer", result: refusal("unreachable") });
    assert.deepEqual(next, { phase: "unreachable", sentence: "The admin backend cannot be reached." });
    assert.equal(phaseFor("unreachable"), "unreachable");
  });

  it("an accepted answer returns the gate to rest", () => {
    assert.equal(nextGate(SUBMITTING, { type: "answer", result: OK }), GATE_START);
  });

  it("drops an answer nothing is waiting for", () => {
    assert.equal(nextGate(GATE_START, { type: "answer", result: refusal("invalid") }), GATE_START);
    assert.equal(nextGate(GATE_START, { type: "answer", result: OK }), GATE_START);
  });

  it("submitting again after a refusal clears the sentence", () => {
    const refused = nextGate(SUBMITTING, { type: "answer", result: refusal("invalid") });
    assert.deepEqual(nextGate(refused, { type: "submit" }), SUBMITTING);
  });

  it("a session that ended returns to idle with the notice, and the notice is not an error", () => {
    const ended = nextGate(GATE_START, { type: "ended", sentence: SESSION_ENDED_NOTICE });
    assert.equal(gateNotice(ended), SESSION_ENDED_NOTICE);
    assert.equal(gateError(ended), null);
    assert.equal(gateNotice(SUBMITTING), null);
  });
});
