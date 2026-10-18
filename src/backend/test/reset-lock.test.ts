// The reset lock and the enumeration rule of docs/40 sections 2.4 to 2.6: five wrong answers lock a username for 15
// minutes whether or not it is an account, every failure is the same bytes, the limiter answers 429 on both routes,
// and no answer or audit entry ever holds the answer.
import assert from "node:assert/strict";
import test from "node:test";

import { attemptRow, auditEntries, code, freshAddress, resetStart, resetWith, setQuestion } from "./reset-kit.js";
import { ADMIN_USERNAME, ADMIN_PASSWORD, makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

const LOCK_MS = 15 * 60 * 1000;
const SECRET_ANSWER = "Zanzibar Marmalade";

async function withQuestion(): Promise<{ t: TestApp; access: string }> {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, SECRET_ANSWER)).status, 200);
  return { t, access };
}

async function fiveWrong(t: TestApp, username: string): Promise<void> {
  for (let i = 0; i < 5; i += 1) assert.equal(code(await resetWith(t.app, username, `wrong ${i}`)), "auth.reset_invalid");
}

test("the fifth wrong answer locks the reset; the right answer is refused during the lock and works after it", async () => {
  const { t, access } = await withQuestion();
  await fiveWrong(t, ADMIN_USERNAME);
  const locked = attemptRow(t.dataDir, ADMIN_USERNAME);
  assert.deepEqual(locked, { failed: 0, locked_until: t.clock.now() + LOCK_MS });

  const refused = await resetWith(t.app, ADMIN_USERNAME, SECRET_ANSWER);
  assert.deepEqual([refused.status, code(refused)], [401, "auth.reset_invalid"]);
  assert.deepEqual(attemptRow(t.dataDir, ADMIN_USERNAME), locked, "a refusal during the lock counts nothing");
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, access)).status, 200, "nothing was reset");

  t.clock.advance(LOCK_MS - 1);
  assert.equal(code(await resetWith(t.app, ADMIN_USERNAME, SECRET_ANSWER)), "auth.reset_invalid", "still locked");
  t.clock.advance(1);
  const done = await resetWith(t.app, ADMIN_USERNAME, SECRET_ANSWER.toLowerCase());
  assert.deepEqual([done.status, pick(done.body, "data.reset")], [200, true]);
  assert.equal(attemptRow(t.dataDir, ADMIN_USERNAME), undefined);

  const entries = await auditEntries(t.app, (await signIn(t.app, ADMIN_USERNAME, "brand-new-password-456")).access);
  const actions = entries.map((e) => e.action);
  assert.equal(actions.filter((a) => a === "auth.reset_failed").length, 7, "five wrong and two refused during the lock");
  assert.equal(actions.filter((a) => a === "auth.reset_locked").length, 1);
  assert.deepEqual(entries.find((e) => e.action === "auth.reset_locked")?.detail, { username: ADMIN_USERNAME });
});

test("after a lock runs out the count starts again from zero", async () => {
  const { t } = await withQuestion();
  await fiveWrong(t, ADMIN_USERNAME);
  t.clock.advance(LOCK_MS);
  await resetWith(t.app, ADMIN_USERNAME, "wrong again");
  assert.deepEqual(attemptRow(t.dataDir, ADMIN_USERNAME), { failed: 1, locked_until: null });
});

test("five wrong answers on an unknown username lock it the same way, with the same audit", async () => {
  const { t, access } = await withQuestion();
  await fiveWrong(t, "Nobody@Example.test");
  assert.deepEqual(attemptRow(t.dataDir, "nobody@example.test"), { failed: 0, locked_until: t.clock.now() + LOCK_MS });
  const locked = (await auditEntries(t.app, access)).find((e) => e.action === "auth.reset_locked");
  assert.deepEqual(locked?.detail, { username: "Nobody@Example.test" });
  assert.equal(code(await resetWith(t.app, "nobody@example.test", SECRET_ANSWER)), "auth.reset_invalid");
});

test("every failure is byte-identical: wrong, locked, unknown, no question, disabled", async () => {
  const { t, access } = await withQuestion();
  const made = async (username: string) =>
    String(pick((await send(t.app, "POST", "/api/admin-accounts", { username, name: "N", password: ADMIN_PASSWORD }, access)).body, "data.id"));
  await made("plain@example.test");
  const offId = await made("off@example.test");
  const off = await signIn(t.app, "off@example.test", ADMIN_PASSWORD);
  assert.equal((await setQuestion(t.app, off.access, SECRET_ANSWER)).status, 200);
  assert.equal((await send(t.app, "PATCH", `/api/admin-accounts/${offId}`, { disabled: true }, access)).status, 200);
  await fiveWrong(t, "locked@example.test");

  const failures = [
    await resetWith(t.app, ADMIN_USERNAME, "wrong"),
    await resetWith(t.app, "locked@example.test", SECRET_ANSWER),
    await resetWith(t.app, "unknown@example.test", SECRET_ANSWER),
    await resetWith(t.app, "plain@example.test", SECRET_ANSWER),
    await resetWith(t.app, "off@example.test", SECRET_ANSWER),
  ];
  const first = failures[0];
  assert.ok(first);
  for (const failure of failures) {
    assert.equal(failure.status, 401);
    assert.equal(failure.raw.toString("utf-8"), first.raw.toString("utf-8"));
    assert.equal(failure.headers["cache-control"], "no-store");
    assert.equal(failure.headers["content-type"], first.headers["content-type"]);
  }
  assert.deepEqual(first.body, {
    ok: false,
    error: { code: "auth.reset_invalid", message: "That answer is not right, or the reset is not available for this username." },
  });
});

test("the limiter answers 429 after ten requests a minute from one address, on both routes", async () => {
  const { t } = await withQuestion();
  for (const route of ["start", "reset"] as const) {
    const address = freshAddress();
    const call = () => (route === "start"
      ? resetStart(t.app, "someone@example.test", address)
      : resetWith(t.app, "someone@example.test", "wrong", undefined, address));
    for (let i = 0; i < 10; i += 1) assert.notEqual((await call()).status, 429);
    const limited = await call();
    assert.deepEqual([limited.status, code(limited)], [429, "auth.rate_limited"]);
    assert.equal(limited.headers["cache-control"], "no-store");
  }
  // The limit is shared with sign-in: the same address is refused there too.
  const address = freshAddress();
  for (let i = 0; i < 10; i += 1) await resetStart(t.app, "someone@example.test", address);
  const login = await send(t.app, "POST", "/api/auth/login", { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }, undefined, address);
  assert.equal(code(login), "auth.rate_limited");
});

test("no answer, audit entry or stored value holds the answer or a password", async () => {
  const { t, access } = await withQuestion();
  const answers = [
    await resetStart(t.app, ADMIN_USERNAME),
    await resetWith(t.app, ADMIN_USERNAME, "Wrong Guess Answer"),
    await resetWith(t.app, ADMIN_USERNAME, SECRET_ANSWER),
  ];
  const fresh = await signIn(t.app, ADMIN_USERNAME, "brand-new-password-456");
  const text = [...answers.map((a) => a.raw.toString("utf-8")), JSON.stringify(await auditEntries(t.app, fresh.access))]
    .join("\n").toLowerCase();
  for (const secret of ["zanzibar", "wrong guess", "brand-new-password", ADMIN_PASSWORD, "scrypt"]) {
    assert.equal(text.includes(secret), false, `nothing answered or audited holds "${secret}"`);
  }
  assert.ok(access);
});
