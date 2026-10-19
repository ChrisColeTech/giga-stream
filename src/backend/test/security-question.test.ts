// The per-account security question route (docs/54 section 2, amending docs/40 section 2.3): a signed-in admin sets
// any selected account's question with no current password, the answer is stored only as its hash, the audit names
// the account and never the answer, and the deleted me-route is gone.
import assert from "node:assert/strict";
import test from "node:test";

import { SECURITY_QUESTIONS } from "../src/constants/security-questions.js";
import { auditEntries, code, makeAccount, QUESTION_ONE, resetStart, storedAnswerHash } from "./reset-kit.js";
import { ADMIN_PASSWORD, ADMIN_USERNAME, makeApp, pick, send, signIn, type Answer } from "./test-app.js";

const me = async (app: Parameters<typeof send>[0], token: string) => send(app, "GET", "/api/admin/auth/me", undefined, token);

/** The route under test: a signed-in admin sets the account `id`'s question. */
const putQuestion = (
  app: Parameters<typeof send>[0],
  token: string,
  id: string,
  question: number,
  answer: string,
): Promise<Answer> => send(app, "PUT", `/api/admin/accounts/${id}/security-question`, { question, answer }, token);

const ownId = async (app: Parameters<typeof send>[0], token: string): Promise<string> =>
  String(pick((await me(app, token)).body, "data.id"));

test("a signed-in admin sets and changes a selected account's question with no current password", async () => {
  const t = await makeApp();
  const { access, refresh } = await signIn(t.app);
  const id = await ownId(t.app, access);
  assert.equal(pick((await me(t.app, access)).body, "data.securityQuestionSet"), false);

  const set = await putQuestion(t.app, access, id, 1, "Rex");
  assert.deepEqual([set.status, set.body], [200, { ok: true, data: { set: true } }]);
  assert.equal(set.headers["cache-control"], "no-store");
  assert.equal(pick((await me(t.app, access)).body, "data.securityQuestionSet"), true);
  const hash = String(await storedAnswerHash(t.dataDir, ADMIN_USERNAME));
  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.toLowerCase().includes("rex"), false);
  assert.equal(pick((await resetStart(t.app, ADMIN_USERNAME)).body, "data.question"), QUESTION_ONE);

  const changed = await putQuestion(t.app, access, id, 3, "Fido");
  assert.equal(changed.status, 200);
  assert.equal(pick((await resetStart(t.app, ADMIN_USERNAME)).body, "data.question"), SECURITY_QUESTIONS[2]);
  assert.equal((await me(t.app, access)).status, 200, "setting a question ends no session");
  assert.equal((await send(t.app, "POST", "/api/admin/auth/refresh", { refreshToken: refresh })).status, 200);
});

test("an admin sets another account's question, not only its own", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const otherId = await makeAccount(t.app, access, "second@example.test");
  assert.equal((await putQuestion(t.app, access, otherId, 5, "Spot")).status, 200);
  assert.equal(await storedAnswerHash(t.dataDir, ADMIN_USERNAME), null);
  assert.match(String(await storedAnswerHash(t.dataDir, "second@example.test")), /^scrypt\$/);
  assert.equal(pick((await resetStart(t.app, "second@example.test")).body, "data.question"), SECURITY_QUESTIONS[4]);
});

test("a question outside 1 to 8 or a long answer is 422 account.invalid naming its field, and nothing is stored", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const id = await ownId(t.app, access);
  for (const question of [0, 9, 1.5]) {
    const refused = await putQuestion(t.app, access, id, question, "Rex");
    assert.deepEqual([refused.status, code(refused), pick(refused.body, "error.details.field")], [422, "account.invalid", "question"]);
  }
  const long = await putQuestion(t.app, access, id, 1, "x".repeat(201));
  assert.deepEqual([long.status, pick(long.body, "error.details.field")], [422, "answer"]);
  // The old me-route's body shape (a currentPassword) is an extra field now, and refused.
  const extra = await send(t.app, "PUT", `/api/admin/accounts/${id}/security-question`,
    { question: 1, answer: "Rex", currentPassword: ADMIN_PASSWORD }, access);
  assert.deepEqual([extra.status, code(extra)], [422, "account.invalid"]);
  assert.equal(await storedAnswerHash(t.dataDir, ADMIN_USERNAME), null);
});

test("without a token the route is 401 auth.unauthorized", async () => {
  const t = await makeApp();
  const refused = await send(t.app, "PUT", "/api/admin/accounts/acct_x/security-question", { question: 1, answer: "Rex" });
  assert.deepEqual([refused.status, code(refused)], [401, "auth.unauthorized"]);
});

test("a gone account answers the admin routes' not-found refusal", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const refused = await putQuestion(t.app, access, "acct_missing", 1, "Rex");
  assert.deepEqual([refused.status, code(refused)], [404, "account.not_found"]);
  assert.equal(pick(refused.body, "error.message"), "That account does not exist.");
});

test("the audit records account.security_question_set with the username and never the answer", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const id = await ownId(t.app, access);
  assert.equal((await putQuestion(t.app, access, id, 1, "Quixotic Answer")).status, 200);
  const entries = await auditEntries(t.app, access);
  const set = entries.find((e) => e.action === "account.security_question_set");
  assert.deepEqual(set?.detail, { username: ADMIN_USERNAME });
  assert.equal(set?.subject, id);
  assert.equal(set?.actorUsername, ADMIN_USERNAME);
  assert.equal(entries.some((e) => e.action === "auth.security_question_set"), false, "the me-route's action is retired");
  const text = JSON.stringify(entries).toLowerCase();
  assert.equal(text.includes("quixotic"), false);
  assert.equal(text.includes(ADMIN_PASSWORD), false);
  assert.equal(text.includes("scrypt"), false);
});

test("the deleted me-route answers 404 route.not_found", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const gone = await send(t.app, "PUT", "/api/admin/auth/me/security-question", { question: 1, answer: "Rex" }, access);
  assert.deepEqual([gone.status, code(gone), pick(gone.body, "error.message")],
    [404, "route.not_found", "There is nothing at that address."]);
});
