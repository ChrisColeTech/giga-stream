// The answer normalisation of docs/40 section 2.2: trimmed, inner spaces collapsed, case folded, NFKC; an answer that
// is empty after it is refused when a question is set.
import assert from "node:assert/strict";
import test from "node:test";

import { normaliseAnswer } from "../src/services/security-answer.js";
import { setQuestion } from "./reset-kit.js";
import { makeApp, pick, signIn } from "./test-app.js";

test("surrounding spaces and case do not count: '  Rex  ', 'rex' and 'REX' are one answer", () => {
  assert.deepEqual(["  Rex  ", "rex", "REX", "\tRex\n"].map(normaliseAnswer), ["rex", "rex", "rex", "rex"]);
});

test("runs of inner white space are one space", () => {
  assert.equal(normaliseAnswer("Golden   Retriever"), normaliseAnswer("golden retriever"));
  assert.equal(normaliseAnswer("Golden \t\n Retriever"), "golden retriever");
});

test("NFKC folds a full-width letter and a ligature to their plain forms", () => {
  assert.equal(normaliseAnswer("ＲＥＸ"), "rex");
  assert.equal(normaliseAnswer("ﬁdo"), "fido");
});

test("an answer of only white space normalises to nothing and is refused as 422 account.invalid", async () => {
  assert.equal(normaliseAnswer("   \t "), "");
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const refused = await setQuestion(t.app, access, "  　 ");
  assert.equal(refused.status, 422);
  assert.equal(pick(refused.body, "error.code"), "account.invalid");
  assert.equal(pick(refused.body, "error.details.field"), "answer");
});
