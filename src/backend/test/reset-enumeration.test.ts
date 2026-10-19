// The enumeration rule of docs/40 sections 2.4 to 2.6: every failure is the same bytes whatever the username is, no
// number of wrong answers locks anything (owner, 2026-10-18: no lockout), and no answer or audit entry holds the answer.
import assert from "node:assert/strict";
import test from "node:test";

import { auditEntries, code, resetStart, resetWith, setQuestion } from "./reset-kit.js";
import { ADMIN_USERNAME, ADMIN_PASSWORD, makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

const SECRET_ANSWER = "Zanzibar Marmalade";

async function withQuestion(): Promise<{ t: TestApp; access: string }> {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await setQuestion(t.app, access, SECRET_ANSWER)).status, 200);
  return { t, access };
}

test("twenty wrong answers lock nothing: the right answer still resets, and every wrong one is audited", async () => {
  const { t, access } = await withQuestion();
  for (let i = 0; i < 20; i += 1) {
    assert.equal(code(await resetWith(t.app, ADMIN_USERNAME, `wrong ${i}`)), "auth.reset_invalid");
  }
  const done = await resetWith(t.app, ADMIN_USERNAME, SECRET_ANSWER.toLowerCase());
  assert.deepEqual([done.status, pick(done.body, "data.reset")], [200, true]);
  const entries = await auditEntries(t.app, (await signIn(t.app, ADMIN_USERNAME, "brand-new-password-456")).access);
  assert.equal(entries.filter((e) => e.action === "auth.reset_failed").length, 20);
  assert.equal(entries.some((e) => e.action === "auth.reset_locked"), false);
  assert.ok(access);
});

test("every failure is byte-identical: wrong, unknown, no question, disabled", async () => {
  const { t, access } = await withQuestion();
  const made = async (username: string) =>
    String(pick((await send(t.app, "POST", "/api/admin/accounts", { username, password: ADMIN_PASSWORD }, access)).body, "data.id"));
  await made("plain@example.test");
  const offId = await made("off@example.test");
  const off = await signIn(t.app, "off@example.test", ADMIN_PASSWORD);
  assert.equal((await setQuestion(t.app, off.access, SECRET_ANSWER)).status, 200);
  assert.equal((await send(t.app, "PATCH", `/api/admin/accounts/${offId}`, { disabled: true }, access)).status, 200);

  const failures = [
    await resetWith(t.app, ADMIN_USERNAME, "wrong"),
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
