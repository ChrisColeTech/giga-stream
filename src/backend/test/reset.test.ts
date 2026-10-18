// The reset routes of docs/40 section 2.4: reset-start answers one shape for every username (the real question or a
// stable HMAC decoy), and a right answer replaces the password, ends every session.
import assert from "node:assert/strict";
import test from "node:test";

import { SECURITY_QUESTIONS } from "../src/constants/security-questions.js";
import {
  auditEntries, code, makeAccount, NEW_PASSWORD, QUESTION_ONE, resetStart, resetWith, setQuestion,
} from "./reset-kit.js";
import { ADMIN_USERNAME, ADMIN_PASSWORD, makeApp, pick, send, signIn } from "./test-app.js";

const questions: readonly string[] = SECURITY_QUESTIONS;
const shape = (body: unknown): string[] => Object.keys(pick(body, "data") as object).sort();

test("reset-start answers the same shape for a real account, an unknown username, no question and a disabled account", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, "Rex")).status, 200);
  const plainId = await makeAccount(t.app, access, "plain@example.test");
  const offId = await makeAccount(t.app, access, "off@example.test");
  const off = await signIn(t.app, "off@example.test", ADMIN_PASSWORD);
  assert.equal((await setQuestion(t.app, off.access, "Spot", 5)).status, 200);
  assert.equal((await send(t.app, "PATCH", `/api/admin-accounts/${offId}`, { disabled: true }, access)).status, 200);
  assert.ok(plainId);

  const answers = await Promise.all(
    [ADMIN_USERNAME, "nobody@example.test", "plain@example.test", "off@example.test"].map((e) => resetStart(t.app, e)),
  );
  for (const answer of answers) {
    assert.equal(answer.status, 200);
    assert.equal(answer.headers["cache-control"], "no-store");
    assert.deepEqual(shape(answer.body), ["question"]);
    assert.ok(questions.includes(String(pick(answer.body, "data.question"))));
  }
  assert.equal(pick(answers[0]?.body, "data.question"), QUESTION_ONE, "the real question for a real account");
  assert.equal(pick(answers[3]?.body, "data.question"), questions[4], "a disabled account keeps its real question");
  assert.equal((await auditEntries(t.app, access)).some((e) => e.action === "auth.reset_failed"), false, "reset-start audits nothing");
});

test("the decoy is the same question on every call for one username, and differs between usernames", async () => {
  const t = await makeApp();
  const first = pick((await resetStart(t.app, "decoy@example.test")).body, "data.question");
  for (const username of ["decoy@example.test", "  DECOY@Example.test "]) {
    assert.equal(pick((await resetStart(t.app, username)).body, "data.question"), first);
  }
  const seen = new Set<unknown>();
  for (let i = 0; i < 40; i += 1) seen.add(pick((await resetStart(t.app, `user${i}@example.test`)).body, "data.question"));
  assert.ok(seen.size >= 2, "over enough usernames more than one decoy question occurs");
  for (const question of seen) assert.ok(questions.includes(String(question)));
});

test("an account with no question answers its decoy, which stays the same after the account is made", async () => {
  const t = await makeApp();
  const before = pick((await resetStart(t.app, "later@example.test")).body, "data.question");
  const { access } = await signIn(t.app);
  await makeAccount(t.app, access, "later@example.test");
  assert.equal(pick((await resetStart(t.app, "later@example.test")).body, "data.question"), before);
});

test("the right answer, normalised, resets the password and ends every session", async () => {
  const t = await makeApp();
  const { access, refresh } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, "Rex")).status, 200);
  await resetWith(t.app, ADMIN_USERNAME, "wrong");

  const done = await resetWith(t.app, ` ${ADMIN_USERNAME.toUpperCase()} `, "  rex ");
  assert.deepEqual([done.status, done.body], [200, { ok: true, data: { reset: true } }]);
  assert.equal(done.headers["cache-control"], "no-store");

  assert.equal(code(await send(t.app, "GET", "/api/auth/me", undefined, access)), "auth.unauthorized");
  assert.equal(code(await send(t.app, "POST", "/api/auth/refresh", { refreshToken: refresh })), "auth.refresh_invalid");
  const old = await send(t.app, "POST", "/api/auth/login", { username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  assert.equal(code(old), "auth.invalid_credentials", "the old password fails");
  const fresh = await signIn(t.app, ADMIN_USERNAME, NEW_PASSWORD);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, fresh.access)).status, 200);

  const again = await resetWith(t.app, ADMIN_USERNAME, "rex", "yet-another-password-789");
  assert.equal(again.status, 200, "the question survives a reset, so the same answer works again");
  const completed = (await auditEntries(t.app, (await signIn(t.app, ADMIN_USERNAME, "yet-another-password-789")).access))
    .filter((e) => e.action === "auth.reset_completed");
  assert.equal(completed.length, 2);
  assert.deepEqual([completed[0]?.detail, completed[0]?.actorUsername], [{ username: ADMIN_USERNAME }, ADMIN_USERNAME]);
});

test("a wrong answer is 401 auth.reset_invalid and audits auth.reset_failed", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, "Rex")).status, 200);
  const wrong = await resetWith(t.app, ADMIN_USERNAME, "Fido");
  assert.deepEqual([wrong.status, code(wrong)], [401, "auth.reset_invalid"]);
  assert.equal(pick(wrong.body, "error.message"), "That answer is not right, or the reset is not available for this username.");
  const failed = (await auditEntries(t.app, access)).find((e) => e.action === "auth.reset_failed");
  assert.deepEqual(failed?.detail, { username: ADMIN_USERNAME });
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, access)).status, 200, "a failure ends no session");
});

test("a disabled account and an account with no question cannot be reset, even with the right answer", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const offId = await makeAccount(t.app, access, "off@example.test");
  const off = await signIn(t.app, "off@example.test", ADMIN_PASSWORD);
  assert.equal((await setQuestion(t.app, off.access, "Spot")).status, 200);
  assert.equal((await send(t.app, "PATCH", `/api/admin-accounts/${offId}`, { disabled: true }, access)).status, 200);
  assert.equal(code(await resetWith(t.app, "off@example.test", "Spot")), "auth.reset_invalid");
  await makeAccount(t.app, access, "plain@example.test");
  assert.equal(code(await resetWith(t.app, "plain@example.test", "")), "auth.reset_invalid");
  assert.equal(code(await resetWith(t.app, "nobody@example.test", "Spot")), "auth.reset_invalid");
});

test("a body that fails its schema is 422 before any lookup and audits nothing", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, "Rex")).status, 200);
  await resetWith(t.app, ADMIN_USERNAME, "wrong");
  const failedCount = async () => (await auditEntries(t.app, access)).filter((e) => e.action === "auth.reset_failed").length;
  const before = await failedCount();
  const long = await resetWith(t.app, ADMIN_USERNAME, "Rex", "p".repeat(257));
  assert.deepEqual([long.status, code(long), pick(long.body, "error.details.field")], [422, "account.invalid", "newPassword"]);
  const extra = await send(t.app, "POST", "/api/auth/reset", { username: ADMIN_USERNAME, answer: "Rex", newPassword: NEW_PASSWORD, id: 1 });
  assert.deepEqual([extra.status, code(extra)], [422, "account.invalid"]);
  const start = await send(t.app, "POST", "/api/auth/reset-start", { username: "x".repeat(255) });
  assert.deepEqual([start.status, code(start)], [422, "account.invalid"]);
  assert.equal(await failedCount(), before, "no failure is audited");
  assert.equal(code(await send(t.app, "GET", "/api/auth/me", undefined, access)), undefined, "the password is unchanged");
});
