import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as copy from "@/constants/reset-copy";
import { REFUSAL_SENTENCES } from "@/constants/sign-in-copy";

describe("the reset's words, word for word", () => {
  it("has the verbs, heading, link and reasons of docs/40", () => {
    assert.deepEqual(
      [copy.FORGOT_LINK, copy.RESET_HEADING, copy.RESET_CONTINUE, copy.RESET_SUBMIT, copy.RESET_BACK],
      ["Forgot password?", "Reset your password", "Continue", "Reset password", "Back to sign in"],
    );
    assert.deepEqual(
      [copy.RESET_USERNAME_REASON, copy.RESET_ANSWER_REASON, copy.RESET_PASSWORD_REASON],
      ["Enter your username.", "Enter your answer.", "Enter a new password."],
    );
    assert.equal(copy.ANSWER_TIP, "Answers are not case sensitive; extra spaces do not count.");
  });

  it("uses the backend's own sentences for the refusals", () => {
    assert.equal(copy.RESET_INVALID, "That answer is not right, or the reset is not available for this username.");
    assert.equal(copy.RESET_RATE_LIMITED, "Too many sign-in attempts; wait a minute.");
    assert.equal(copy.RESET_UNREACHABLE, "The admin backend cannot be reached.");
    assert.equal(copy.RESET_RATE_LIMITED, REFUSAL_SENTENCES.rate_limited);
    assert.equal(copy.RESET_PASSWORD_LONG, "Password must be at most 256 characters.");
  });

  it("says that a question-less account needs a signed-in admin to set one first", () => {
    assert.match(copy.NO_QUESTION_REASON, /no security question was ever set/);
    assert.match(copy.NO_QUESTION_REASON, /signed-in admin must set one first/);
    assert.match(copy.NO_QUESTION_REASON, /Settings > Account/);
  });

  it("names the success notice and fixes the labels' column", () => {
    assert.deepEqual([copy.RESET_DONE_TITLE, copy.RESET_DONE_NOTICE], ["Password reset", "Password reset. Sign in."]);
    assert.deepEqual([...copy.RESET_LABELS], ["Username", "Question", "Answer", "New password"]);
  });

  it("mentions no email, address, code or message sent anywhere", () => {
    const all = Object.values(copy).flat().filter((v): v is string => typeof v === "string").join(" ").toLowerCase();
    for (const word of ["email", "e-mail", "code", "sent", "inbox"]) assert.ok(!all.includes(word), word);
  });
});
