import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { ResetAnswerForm } from "@/components/session/ResetAnswerForm";
import { ResetUsernameForm } from "@/components/session/ResetUsernameForm";
import { RESET_INVALID } from "@/constants/reset-copy";
import { RESET_START, type ResetState } from "@/lib/reset-state";
import { renderLive, resetStore } from "./support/store";

const QUESTION = "What was the make of your first car?";
const noop = (): void => undefined;
const answerState = (extra: Partial<ResetState> = {}): ResetState => ({
  ...RESET_START,
  view: "reset-answer",
  username: "ada",
  question: QUESTION,
  ...extra,
});
const usernameView = (initialUsername: string, busy = false): string =>
  renderLive(createElement(ResetUsernameForm, { initialUsername, busy, onContinue: noop, onBack: noop }));
const answerView = (state: ResetState): string =>
  renderLive(createElement(ResetAnswerForm, { state, onReset: async () => null, onBack: noop }));
const at = (html: string, text: string): number => html.indexOf(text);

beforeEach(resetStore);

describe("the username view", () => {
  it("has the heading, one Username row, the primary Continue and the ghost Back, and no placeholder", () => {
    const html = usernameView("");
    assert.ok(html.includes("Reset your password"));
    assert.equal(html.split('aria-label="Username"').length - 1, 1);
    assert.ok(html.includes('autoComplete="username"'));
    assert.ok(at(html, "Continue") < at(html, "Back to sign in"));
    assert.ok(!/\splaceholder=/.test(html) && !html.includes("aria-disabled"));
  });

  it("disables Continue with `Enter your username.` while empty, and carries the typed username over", () => {
    assert.ok(usernameView("").includes('aria-label="Continue. Enter your username."'));
    const filled = usernameView("ada");
    assert.ok(filled.includes('value="ada"') && !filled.includes('aria-label="Continue.'));
  });

  it("waits natively: the field, Continue and Back are disabled with the waiting reason", () => {
    const html = usernameView("ada", true);
    assert.ok(html.includes('aria-label="Continue. Waiting for the answer."'));
    assert.ok(html.includes('aria-label="Back to sign in. Waiting for the answer."'));
    assert.equal(html.split('disabled=""').length - 1, 3);
  });
});

describe("the answer view", () => {
  it("shows Question (read only), Answer and New password in that order, with the right autocomplete", () => {
    const html = answerView(answerState());
    assert.ok(at(html, QUESTION) > -1 && at(html, "Question") < at(html, QUESTION));
    assert.ok(at(html, QUESTION) < at(html, 'aria-label="Answer"'));
    assert.ok(at(html, 'aria-label="Answer"') < at(html, 'aria-label="New password"'));
    assert.ok(html.includes('autoComplete="off"') && html.includes('autoComplete="new-password"'));
    assert.ok(html.includes('type="password"') && !html.includes('type="email"'));
    assert.ok(!/\splaceholder=/.test(html) && !html.includes("aria-disabled"));
  });

  it("says plainly, under the question and for every username, that a signed-in admin must set one first", () => {
    const html = answerView(answerState());
    assert.ok(html.includes("No security question?"));
    assert.ok(html.includes("a signed-in admin must set one first, under Settings &gt; Account."));
    assert.ok(at(html, QUESTION) < at(html, "No security question?"));
    assert.ok(at(html, "No security question?") < at(html, 'aria-label="Answer"'));
    const other = answerView(answerState({ username: "someone-else" }));
    assert.equal(other.replace(/someone-else/g, "ada"), html, "identical whatever the username");
  });

  it("disables Reset password with its reason: the answer first, then the new password", () => {
    assert.ok(answerView(answerState()).includes('aria-label="Reset password. Enter your answer."'));
    assert.ok(answerView(answerState({ busy: true })).includes('aria-label="Resetting. Waiting for the answer."'));
    assert.ok(answerView(answerState()).includes("Back to sign in"));
  });

  it("puts a refusal under its own row as an alert, and marks only that field invalid", () => {
    const answer = answerView(answerState({ error: { field: "answer", sentence: RESET_INVALID } }));
    assert.ok(answer.includes('role="alert"') && answer.includes(RESET_INVALID));
    assert.ok(at(answer, 'aria-label="Answer"') < at(answer, RESET_INVALID));
    assert.ok(at(answer, RESET_INVALID) < at(answer, 'aria-label="New password"'));
    assert.equal(answer.split('aria-invalid="true"').length - 1, 1);
    const password = answerView(answerState({ error: { field: "newPassword", sentence: "Too long." } }));
    assert.ok(at(password, 'aria-label="New password"') < at(password, "Too long."));
  });
});
