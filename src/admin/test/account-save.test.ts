import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANSWER_TOO_LONG, CHOOSE_QUESTION_REASON, ENTER_ANSWER_REASON, SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { NOTHING_CHANGED } from "@/constants/record-copy";
import { EMPTY_QUESTION_DRAFT, type QuestionDraft } from "@/lib/account-question";
import { accountSaveReason, questionHeld, saveAccountRecord, type AccountSaveParts } from "@/lib/account-save";
import type { AccountField, FlowResult } from "@/services/account-flows";
import type { FlowRefused } from "@/services/account-flow-support";
import type { AdminAccount } from "@/types/admin-account";

/* The Accounts one-Save (`55` decision 5): the toolbar's Save commits the ENTIRE record - the account fields, then
 * the Security question while its group holds a draft. The composition is pure over the two flows, so the order,
 * the draft gating and the partial-failure behaviour are tested here. */

const ME: AdminAccount = { id: 7, username: "ada@example.test", disabled: false, createdAt: 1, updatedAt: 1 };
const saved: FlowResult<AdminAccount | null> = { ok: true, value: { ...ME, username: "ada@new.test" } };
const clean: FlowResult<AdminAccount | null> = { ok: true, value: null };
const refused = (sentence: string, field?: AccountField): FlowRefused => ({ ok: false, sentence, ...(field !== undefined && { field }) });
const DROPPED: FlowResult = { ok: false, sentence: "", dropped: true };

function rig(fields: FlowResult<AdminAccount | null>, question: FlowResult) {
  const calls: string[] = [];
  const parts: AccountSaveParts = {
    fields: async () => (calls.push("fields"), fields),
    question: async (number, answer) => (calls.push(`question:${number}:${answer}`), question),
  };
  return { parts, calls };
}

describe("the draft the group holds", () => {
  it("is present when a question is chosen OR an answer is typed; an empty draft skips the question", () => {
    assert.equal(questionHeld(EMPTY_QUESTION_DRAFT), false);
    assert.equal(questionHeld({ question: "3", answer: "" }), true);
    assert.equal(questionHeld({ question: "", answer: "Rex" }), true);
    assert.equal(questionHeld({ question: "3", answer: "  " }), true, "a typed answer, however blank, is a draft");
  });
});

describe("the one Save's press", () => {
  it("commits only the fields while no draft is held: the question flow is never asked", async () => {
    const { parts, calls } = rig(saved, { ok: true, value: undefined });
    const outcome = await saveAccountRecord(parts, EMPTY_QUESTION_DRAFT);
    assert.deepEqual(calls, ["fields"]);
    assert.deepEqual(outcome, { stage: "saved", account: saved.value });
  });

  it("commits the question after the fields succeed, sending the number the draft holds and the answer as typed", async () => {
    const { parts, calls } = rig(saved, { ok: true, value: undefined });
    const outcome = await saveAccountRecord(parts, { question: "3", answer: "  Rex  " });
    assert.deepEqual(calls, ["fields", "question:3:  Rex  "]);
    assert.deepEqual(outcome, { stage: "saved", account: saved.value });
  });

  it("gates the WHOLE Save on the question's own reasons while a draft is held: nothing is sent", async () => {
    const cases: readonly [QuestionDraft, string, "question" | "answer"][] = [
      [{ question: "", answer: "Rex" }, CHOOSE_QUESTION_REASON, "question"],
      [{ question: "3", answer: "" }, ENTER_ANSWER_REASON, "answer"],
      [{ question: "3", answer: "x".repeat(201) }, ANSWER_TOO_LONG, "answer"],
    ];
    for (const [draft, sentence, field] of cases) {
      const { parts, calls } = rig(saved, { ok: true, value: undefined });
      const outcome = await saveAccountRecord(parts, draft);
      assert.deepEqual(calls, [], "nothing is sent while the question's gate stands");
      assert.deepEqual(outcome, { stage: "question-refused", account: null, sentence, field });
    }
  });

  it("stops on a fields refusal before the question is sent: the sentence goes under the fields' row", async () => {
    const { parts, calls } = rig(refused("Username must be 1 to 254 characters.", "username"), { ok: true, value: undefined });
    const outcome = await saveAccountRecord(parts, { question: "3", answer: "Rex" });
    assert.deepEqual(calls, ["fields"]);
    assert.deepEqual(outcome, { stage: "fields-refused", sentence: "Username must be 1 to 254 characters.", field: "username" });
  });

  it("keeps the fields saved when the question is refused: the outcome carries their answer beside its row's sentence", async () => {
    const { parts, calls } = rig(saved, refused("The answer is not valid.", "answer"));
    const outcome = await saveAccountRecord(parts, { question: "3", answer: "Rex" });
    assert.deepEqual(calls, ["fields", "question:3:Rex"]);
    assert.deepEqual(outcome, { stage: "question-refused", account: saved.value, sentence: "The answer is not valid.", field: "answer" });
  });

  it("says a question refusal that names no row under none (the notice line has said it once)", async () => {
    const { parts } = rig(saved, refused("That account no longer exists."));
    const outcome = await saveAccountRecord(parts, { question: "3", answer: "Rex" });
    assert.deepEqual(outcome, { stage: "question-refused", account: saved.value, sentence: "That account no longer exists." });
  });

  it("does nothing when either part belongs to an earlier session", async () => {
    const droppedFields = rig({ ok: false, sentence: "", dropped: true }, { ok: true, value: undefined });
    assert.deepEqual([await saveAccountRecord(droppedFields.parts, { question: "3", answer: "Rex" })], [{ stage: "dropped" }]);
    const droppedQuestion = rig(saved, DROPPED);
    assert.deepEqual([await saveAccountRecord(droppedQuestion.parts, { question: "3", answer: "Rex" })], [{ stage: "dropped" }]);
  });

  it("returns the fields' own answer when nothing changed: the flow, not the press, decides that", async () => {
    const { parts, calls } = rig(clean, { ok: true, value: undefined });
    assert.deepEqual([await saveAccountRecord(parts, EMPTY_QUESTION_DRAFT)], [{ stage: "saved", account: null }]);
    assert.deepEqual(calls, ["fields"]);
  });
});

describe("the one Save's reason", () => {
  it("is `Nothing has changed.` only while the whole record is clean: fields and question draft both", () => {
    assert.equal(accountSaveReason(false, EMPTY_QUESTION_DRAFT, false, false), NOTHING_CHANGED);
    assert.equal(accountSaveReason(true, EMPTY_QUESTION_DRAFT, false, false), undefined);
    assert.equal(accountSaveReason(false, { question: "3", answer: "Rex" }, false, false), undefined, "a held draft is something to save");
  });

  it("is the question's own reason while a draft is held, then the fields' own (a call going, the unreachable sentence)", () => {
    assert.equal(accountSaveReason(false, { question: "", answer: "Rex" }, false, false), CHOOSE_QUESTION_REASON);
    assert.equal(accountSaveReason(true, { question: "3", answer: "" }, false, false), ENTER_ANSWER_REASON, "the question gates the whole Save");
    assert.equal(accountSaveReason(false, { question: "3", answer: "Rex" }, true, false), SAVING_REASON);
    assert.equal(accountSaveReason(true, EMPTY_QUESTION_DRAFT, true, false), SAVING_REASON);
    assert.equal(accountSaveReason(true, EMPTY_QUESTION_DRAFT, false, true), UNREACHABLE_REASON);
  });
});
