// Setting the security question (docs/40 section 2.3): signed in, own account only, the current password required,
// no session ends, and the audit names the account and never the answer.
import assert from "node:assert/strict";
import test from "node:test";

import { auditEntries, code, makeAccount, QUESTION_ONE, resetStart, setQuestion, storedAnswerHash } from "./reset-kit.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD, makeApp, pick, send, signIn } from "./test-app.js";

const me = async (app: Parameters<typeof send>[0], token: string) => send(app, "GET", "/api/auth/me", undefined, token);

test("a signed-in account sets its question with its current password; the answer is stored as a scrypt hash", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal(pick((await me(t.app, access)).body, "data.securityQuestionSet"), false);
  const set = await setQuestion(t.app, access, "Rex");
  assert.deepEqual([set.status, set.body], [200, { ok: true, data: { set: true } }]);
  assert.equal(set.headers["cache-control"], "no-store");
  assert.equal(pick((await me(t.app, access)).body, "data.securityQuestionSet"), true);
  const hash = String(storedAnswerHash(t.dataDir, ADMIN_EMAIL));
  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.toLowerCase().includes("rex"), false);
  assert.equal(pick((await resetStart(t.app, ADMIN_EMAIL)).body, "data.question"), QUESTION_ONE);
});

test("a wrong current password is 401 auth.invalid_credentials naming currentPassword, and changes nothing", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const wrong = await setQuestion(t.app, access, "Rex", 1, "not-the-password");
  assert.deepEqual([wrong.status, code(wrong), pick(wrong.body, "error.details.field")], [401, "auth.invalid_credentials", "currentPassword"]);
  assert.equal(storedAnswerHash(t.dataDir, ADMIN_EMAIL), null);
  assert.equal(pick((await me(t.app, access)).body, "data.securityQuestionSet"), false);
});

test("a question outside 1 to 8, a long answer or an extra field is 422 account.invalid", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  for (const question of [0, 9, 1.5]) {
    const refused = await setQuestion(t.app, access, "Rex", question);
    assert.deepEqual([refused.status, code(refused), pick(refused.body, "error.details.field")], [422, "account.invalid", "question"]);
  }
  const long = await setQuestion(t.app, access, "x".repeat(201));
  assert.deepEqual([long.status, pick(long.body, "error.details.field")], [422, "answer"]);
  const body = { currentPassword: ADMIN_PASSWORD, question: 1, answer: "Rex", accountId: "acct_other" };
  const extra = await send(t.app, "PUT", "/api/auth/me/security-question", body, access);
  assert.deepEqual([extra.status, code(extra)], [422, "account.invalid"]);
  assert.equal(storedAnswerHash(t.dataDir, ADMIN_EMAIL), null);
});

test("without a token the route is 401 auth.unauthorized", async () => {
  const t = await makeApp();
  const body = { currentPassword: ADMIN_PASSWORD, question: 1, answer: "Rex" };
  const refused = await send(t.app, "PUT", "/api/auth/me/security-question", body);
  assert.deepEqual([refused.status, code(refused)], [401, "auth.unauthorized"]);
});

test("setting the question ends no session: the access and refresh tokens keep working", async () => {
  const t = await makeApp();
  const { access, refresh } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, "Rex")).status, 200);
  assert.equal((await setQuestion(t.app, access, "Fido", 3)).status, 200);
  assert.equal((await me(t.app, access)).status, 200);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: refresh })).status, 200);
  assert.equal(pick((await resetStart(t.app, ADMIN_EMAIL)).body, "data.question"), "What was the name of your first school?");
});

test("an account sets only its own question: another account's token changes the other account", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  await makeAccount(t.app, access, "second@example.test");
  const second = await signIn(t.app, "second@example.test", ADMIN_PASSWORD);
  assert.equal((await setQuestion(t.app, second.access, "Rex")).status, 200);
  assert.equal(storedAnswerHash(t.dataDir, ADMIN_EMAIL), null);
  assert.match(String(storedAnswerHash(t.dataDir, "second@example.test")), /^scrypt\$/);
});

test("the audit records auth.security_question_set with the email and never the answer", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, "Quixotic Answer")).status, 200);
  const entries = await auditEntries(t.app, access);
  const set = entries.find((e) => e.action === "auth.security_question_set");
  assert.deepEqual(set?.detail, { email: ADMIN_EMAIL });
  assert.equal(set?.actorEmail, ADMIN_EMAIL);
  const text = JSON.stringify(entries).toLowerCase();
  assert.equal(text.includes("quixotic"), false);
  assert.equal(text.includes(ADMIN_PASSWORD), false);
  assert.equal(text.includes("scrypt"), false);
});
