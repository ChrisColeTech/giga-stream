import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESET_DONE_NOTICE,
  RESET_DONE_TITLE,
  RESET_INVALID,
  RESET_RATE_LIMITED,
  RESET_UNREACHABLE,
  RESET_WEAK,
} from "@/constants/reset-copy";
import { nextReset, RESET_START, type ResetEvent, type ResetState } from "@/lib/reset-state";
import { continueReason, newPasswordRefusal, resetReason } from "@/lib/reset-verb";

const run = (state: ResetState, ...events: ResetEvent[]): ResetState => events.reduce(nextReset, state);
const QUESTION = "What was the name of your first pet?";
const asking = run(RESET_START, { type: "forgot", username: "ada" }, { type: "submit" });
const answering = run(asking, { type: "started", username: "ada", result: { ok: true, question: QUESTION } });
const waiting = run(answering, { type: "submit" });

describe("the reset views", () => {
  it("opens from the sign-in view with the typed username carried over", () => {
    const next = run(RESET_START, { type: "forgot", username: "  Ada " });
    assert.deepEqual([next.view, next.username, next.busy, next.notice, next.error], ["reset-username", "  Ada ", false, null, null]);
  });

  it("ignores `forgot` anywhere but the sign-in view", () => {
    assert.equal(nextReset(answering, { type: "forgot", username: "x" }), answering);
  });

  it("goes back to sign-in keeping the username (the one carried by the event wins), clearing everything else", () => {
    const first = run(RESET_START, { type: "forgot", username: "ada" }, { type: "back", username: "ada2" });
    assert.deepEqual(first, { ...RESET_START, username: "ada2" });
    const second = run(answering, { type: "back" });
    assert.deepEqual(second, { ...RESET_START, username: "ada" });
  });

  it("does not go back, or submit twice, while a call waits", () => {
    assert.equal(nextReset(asking, { type: "back" }), asking);
    assert.equal(nextReset(asking, { type: "submit" }), asking);
    assert.equal(nextReset(RESET_START, { type: "submit" }), RESET_START, "nothing to submit on the sign-in view");
  });

  it("shows the question after reset-start, trimmed username kept, and stops waiting", () => {
    assert.deepEqual(
      [answering.view, answering.question, answering.username, answering.busy, answering.notice],
      ["reset-answer", QUESTION, "ada", false, null],
    );
  });

  it("stays on the username view with the rate-limit or unreachable sentence on a card", () => {
    const limited = run(asking, { type: "started", username: "ada", result: { ok: false, refusal: "rate_limited" } });
    assert.deepEqual([limited.view, limited.busy, limited.notice?.sentence], ["reset-username", false, RESET_RATE_LIMITED]);
    const down = run(asking, { type: "started", username: "ada", result: { ok: false, refusal: "unreachable" } });
    assert.equal(down.notice?.sentence, RESET_UNREACHABLE);
    assert.equal(run(down, { type: "submit" }).notice, null, "a new try clears the card");
  });

  it("drops an answer that arrives after the person went back, or twice", () => {
    const back = run(RESET_START, { type: "forgot", username: "ada" });
    assert.equal(nextReset(back, { type: "started", username: "ada", result: { ok: true, question: QUESTION } }), back);
    assert.equal(nextReset(answering, { type: "started", username: "ada", result: { ok: true, question: "x" } }), answering);
    assert.equal(nextReset(answering, { type: "finished", result: { ok: true } }), answering, "nothing was waiting");
  });

  it("returns to sign-in with `Password reset. Sign in.` on success", () => {
    const done = run(waiting, { type: "finished", result: { ok: true } });
    assert.deepEqual([done.view, done.username, done.question, done.busy, done.error], ["signin", "ada", "", false, null]);
    assert.deepEqual(done.notice, { title: RESET_DONE_TITLE, sentence: RESET_DONE_NOTICE });
    assert.equal(RESET_DONE_NOTICE, "Password reset. Sign in.");
  });

  it("puts the one backend sentence under Answer for `invalid`, and the question stays", () => {
    const refused = run(waiting, { type: "finished", result: { ok: false, refusal: "invalid" } });
    assert.deepEqual([refused.view, refused.question, refused.busy], ["reset-answer", QUESTION, false]);
    assert.deepEqual(refused.error, { field: "answer", sentence: RESET_INVALID });
    assert.equal(RESET_INVALID, "That answer is not right, or the reset is not available for this username.");
  });

  it("puts the weak-password sentence under New password", () => {
    const refused = run(waiting, { type: "finished", result: { ok: false, refusal: "weak" } });
    assert.deepEqual(refused.error, { field: "newPassword", sentence: RESET_WEAK });
  });

  it("puts a rate limit or an unreachable backend on the card, with no field error", () => {
    const limited = run(waiting, { type: "finished", result: { ok: false, refusal: "rate_limited" } });
    assert.deepEqual([limited.notice?.sentence, limited.error, limited.view], [RESET_RATE_LIMITED, null, "reset-answer"]);
    const down = run(waiting, { type: "finished", result: { ok: false, refusal: "unreachable" } });
    assert.equal(down.notice?.sentence, RESET_UNREACHABLE);
  });

  it("clears the last refusal on the next submit, and takes a client refusal only when idle", () => {
    const refused = run(waiting, { type: "finished", result: { ok: false, refusal: "invalid" } });
    assert.equal(run(refused, { type: "submit" }).error, null);
    const long = run(answering, { type: "refused", field: "newPassword", sentence: "Too long." });
    assert.deepEqual(long.error, { field: "newPassword", sentence: "Too long." });
    assert.equal(nextReset(waiting, { type: "refused", field: "answer", sentence: "x" }), waiting);
    assert.equal(nextReset(RESET_START, { type: "refused", field: "answer", sentence: "x" }), RESET_START);
  });
});

describe("the reset verbs' reasons", () => {
  it("Continue: waiting wins, then the empty username", () => {
    assert.equal(continueReason("ada", true), "Waiting for the answer.");
    assert.equal(continueReason("   ", false), "Enter your username.");
    assert.equal(continueReason("ada", false), undefined);
  });

  it("Reset password: waiting, then the answer, then the new password", () => {
    assert.equal(resetReason("rex", "x", true), "Waiting for the answer.");
    assert.equal(resetReason("  ", "", false), "Enter your answer.");
    assert.equal(resetReason("rex", "", false), "Enter a new password.");
    assert.equal(resetReason("rex", " ", false), undefined, "a space is part of a password");
  });

  it("checks the new password's length before anything is sent", () => {
    assert.equal(newPasswordRefusal("x".repeat(256)), null);
    assert.equal(newPasswordRefusal("x".repeat(257)), "Password must be at most 256 characters.");
  });
});
