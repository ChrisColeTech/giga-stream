import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { SecurityQuestionSection } from "@/components/settings/SecurityQuestionSection";
import { SECURITY_QUESTIONS, SECURITY_QUESTION_OPTIONS } from "@/constants/security-questions";
import {
  answerRefusal,
  EMPTY_QUESTION_DRAFT,
  questionBody,
  questionStatus,
  saveQuestionReason,
} from "@/lib/security-question-form";
import { questionRefusalFor } from "@/services/security-question";
import { useAppStore } from "@/store/app-store";
import { ApiError } from "@giga/http/api-error";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const page = (): string => renderLive(createElement(SecurityQuestionSection));
const at = (html: string, text: string): number => html.indexOf(text);
const DRAFT = { question: "3", answer: "Rex", currentPassword: "pw" };

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the question picklist", () => {
  it("is the backend's eight, in its order, numbered 1 to 8", () => {
    const backend = readFileSync(new URL("../../backend/src/constants/security-questions.ts", import.meta.url), "utf8");
    const listed = Array.from(backend.matchAll(/^ {2}"(.+)",$/gm), (match) => match[1]);
    assert.deepEqual([...SECURITY_QUESTIONS], listed);
    assert.deepEqual(SECURITY_QUESTION_OPTIONS.map((option) => option.value), [1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("Save question's reasons", () => {
  it("names the first missing field, in the form's order, then a running call", () => {
    assert.equal(saveQuestionReason(EMPTY_QUESTION_DRAFT, true, false), "Choose a question.");
    assert.equal(saveQuestionReason({ ...EMPTY_QUESTION_DRAFT, question: "1" }, true, false), "Enter your answer.");
    assert.equal(saveQuestionReason({ ...DRAFT, answer: "  ", currentPassword: "" }, true, false), "Enter your answer.");
    assert.equal(saveQuestionReason({ ...DRAFT, currentPassword: "" }, true, false), "Enter your current password.");
    assert.equal(saveQuestionReason(DRAFT, true, true), "Saving.");
    assert.equal(saveQuestionReason(DRAFT, true, false), undefined);
    assert.equal(saveQuestionReason(DRAFT, false, false), "You are not signed in.");
  });

  it("builds the body with the number, the answer as typed and the password untouched", () => {
    assert.deepEqual(questionBody({ question: "3", answer: " Rex ", currentPassword: " p " }), {
      currentPassword: " p ",
      question: 3,
      answer: " Rex ",
    });
    assert.equal(answerRefusal("x".repeat(200)), null);
    assert.equal(answerRefusal("x".repeat(201)), "Answer must be at most 200 characters.");
    assert.deepEqual([questionStatus(true), questionStatus(false), questionStatus(undefined)], ["Set", "Not set", "Not set"]);
  });
});

describe("the refusals, by row", () => {
  it("puts a wrong current password (401) under Current password, in its own words", () => {
    const error = new ApiError("auth.invalid_credentials", "The username or password is wrong.", 401, {
      field: "currentPassword",
    });
    assert.deepEqual(questionRefusalFor(error), { field: "currentPassword", sentence: "That current password is wrong." });
  });

  it("puts a 422 under the answer or the question, and anything else on the notice line", () => {
    const answer = new ApiError("account.invalid", "That account is not valid.", 422, { field: "answer" });
    assert.deepEqual(questionRefusalFor(answer), { field: "answer", sentence: "The answer is not valid." });
    const question = new ApiError("account.invalid", "That account is not valid.", 422, { field: "question" });
    assert.equal(questionRefusalFor(question).field, "question");
    const down = new ApiError("backend.unreachable", "The admin backend cannot be reached.");
    assert.deepEqual(questionRefusalFor(down), { field: null, sentence: "The admin backend cannot be reached." });
    assert.equal(questionRefusalFor(new Error("x")).field, null);
  });
});

describe("the Account page", () => {
  it("has Security question, Answer and Current password in that order, with the right inputs", () => {
    const html = page();
    assert.ok(at(html, 'aria-label="Security question"') < at(html, 'aria-label="Answer"'));
    assert.ok(at(html, 'aria-label="Answer"') < at(html, 'aria-label="Current password"'));
    assert.ok(html.includes("<select") && html.includes('type="password"') && html.includes('autoComplete="off"'));
    for (const question of SECURITY_QUESTIONS) assert.ok(html.includes(question.replace("'", "&#x27;")), question);
    assert.ok(!/\splaceholder=/.test(html) && !html.includes("aria-disabled"));
  });

  it("saves with one primary, `Save question`, disabled with the first missing field's reason", () => {
    const html = page();
    assert.ok(html.includes('aria-label="Save question. Choose a question."'));
    assert.equal(html.split("Save question").length - 1 >= 1, true);
  });

  it("reads Not set, then Set once the signed-in account holds a question", () => {
    assert.ok(page().includes("Not set"));
    state().updateActor({ id: 7, username: "ada@example.test", securityQuestionSet: true });
    const html = page();
    assert.ok(html.includes(">Set<") && !html.includes("Not set"));
  });

  it("keeps the held flag when an own-account update does not carry it", () => {
    state().updateActor({ id: 7, username: "ada@example.test", securityQuestionSet: true });
    state().updateActor({ id: 7, username: "ada@new.test" });
    assert.deepEqual(state().actor, { id: 7, username: "ada@new.test", securityQuestionSet: true });
  });

  it("disables its controls natively while nobody is signed in, and says so on the verb", () => {
    state().signOut();
    const html = page();
    assert.ok(html.includes('aria-label="Save question. You are not signed in."'));
    assert.ok(html.split('disabled=""').length - 1 >= 4);
  });
});
