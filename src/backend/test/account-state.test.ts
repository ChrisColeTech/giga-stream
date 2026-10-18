// The per-account settings and shell layout (docs/29 section 12.2, B1): each account's own row, whole documents,
// refusals that name the field, and no audit entry for a preference.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import test from "node:test";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

const DEFAULT_SETTINGS = { theme: "dark", themeAccent: "amber", reducedMotion: "system", uiZoom: 1 };
const DEFAULT_SHELL = { tab: "channels", panes: {}, eventsOpen: false, windows: {} };
const SETTINGS = { theme: "light", themeAccent: "rose", reducedMotion: "on", uiZoom: 1.2 };
const SHELL = {
  tab: "jobs",
  panes: { channels: { open: false, width: 300 }, jobs: { open: true, width: 800 } },
  eventsOpen: true,
  windows: { settings: { x: 10, y: 20, width: 640, height: 480 }, preview: { x: 0, y: 0, width: 1, height: 20_000 } },
};
const ED = { username:"ed@example.test", name: "Ed", password: "ed-password-12345" };
const STATE = "/api/auth/me/state";

/** A second account, signed in, with its id. */
async function edAccount(t: TestApp, adminToken: string) {
  const made = await send(t.app, "POST", "/api/admin-accounts", ED, adminToken);
  assert.equal(made.status, 201);
  const session = await signIn(t.app, ED.username,ED.password);
  return { id: String(pick(made.body, "data.id")), token: session.access };
}

test("a new account reads the defaults, with no updatedAt", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const got = await send(t.app, "GET", STATE, undefined, access);
  assert.equal(got.status, 200);
  assert.deepEqual(pick(got.body, "data.settings"), DEFAULT_SETTINGS);
  assert.deepEqual(pick(got.body, "data.shell"), DEFAULT_SHELL);
  assert.equal(pick(got.body, "data.updatedAt"), undefined);
});

test("no token and a bad token are auth.unauthorized for both routes", async () => {
  const t = await makeApp();
  for (const token of [undefined, "not-a-token"]) {
    for (const method of ["GET", "PUT"] as const) {
      const answer = await send(t.app, method, STATE, { settings: SETTINGS }, token);
      assert.equal(answer.status, 401);
      assert.equal(pick(answer.body, "error.code"), "auth.unauthorized");
    }
  }
});

test("a disabled account's token is refused at once", async () => {
  const t = await makeApp();
  const admin = (await signIn(t.app)).access;
  const ed = await edAccount(t, admin);
  assert.equal((await send(t.app, "GET", STATE, undefined, ed.token)).status, 200);
  const disabled = await send(t.app, "PATCH", `/api/admin-accounts/${ed.id}`, { disabled: true }, admin);
  assert.equal(disabled.status, 200);
  const refused = await send(t.app, "GET", STATE, undefined, ed.token);
  assert.equal(pick(refused.body, "error.code"), "auth.unauthorized");
});

test("PUT settings then GET round-trips the document and sets updatedAt to the write's time", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const put = await send(t.app, "PUT", STATE, { settings: SETTINGS }, access);
  assert.equal(put.status, 200);
  assert.deepEqual(pick(put.body, "data.settings"), SETTINGS);
  assert.equal(pick(put.body, "data.updatedAt"), t.clock.now());
  const got = await send(t.app, "GET", STATE, undefined, access);
  assert.deepEqual(pick(got.body, "data"), { settings: SETTINGS, shell: DEFAULT_SHELL, updatedAt: t.clock.now() });
});

test("PUT shell leaves settings untouched and replaces the shell whole", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  await send(t.app, "PUT", STATE, { settings: SETTINGS }, access);
  t.clock.advance(1000);
  const put = await send(t.app, "PUT", STATE, { shell: SHELL }, access);
  assert.equal(pick(put.body, "data.updatedAt"), t.clock.now());
  const got = await send(t.app, "GET", STATE, undefined, access);
  assert.deepEqual(pick(got.body, "data"), { settings: SETTINGS, shell: SHELL, updatedAt: t.clock.now() });
  await send(t.app, "PUT", STATE, { shell: DEFAULT_SHELL }, access);
  assert.deepEqual(pick((await send(t.app, "GET", STATE, undefined, access)).body, "data.settings"), SETTINGS);
});

test("an unknown key, a bad value or an empty body is account_state.invalid, naming the field", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const cases: Array<[unknown, string]> = [
    [{ settings: { ...SETTINGS, foo: 1 } }, "foo"],
    [{ shell: { ...SHELL, panes: { bar: { open: true, width: 200 } } } }, "bar"],
    [{ settings: SETTINGS, extra: true }, "extra"],
    [{}, "body"],
    [{ shell: { ...SHELL, tab: "bogus" } }, "shell.tab"],
    [{ shell: { ...SHELL, panes: { channels: { open: true, width: 40 } } } }, "shell.panes.channels.width"],
    [{ settings: { ...SETTINGS, uiZoom: 0.55 } }, "settings.uiZoom"],
    [
      { shell: { ...SHELL, windows: { settings: { x: -1, y: 0, width: 10, height: 10 } } } },
      "shell.windows.settings.x",
    ],
  ];
  for (const [body, field] of cases) {
    const answer = await send(t.app, "PUT", STATE, body, access);
    const seen = [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
    assert.deepEqual(seen, [422, "account_state.invalid", field]);
  }
  const stored = await send(t.app, "GET", STATE, undefined, access);
  assert.equal(pick(stored.body, "data.updatedAt"), undefined, "nothing was written");
});

test("the bounds are inclusive: a width of 120 and 800, a zoom of 0.5 and 3, a coordinate of 20000", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const edge = {
    settings: { ...SETTINGS, uiZoom: 3 },
    shell: { ...SHELL, panes: { channels: { open: true, width: 120 }, jobs: { open: true, width: 800 } },
      windows: { settings: { x: 20_000, y: 0, width: 1, height: 20_000 } } },
  };
  assert.equal((await send(t.app, "PUT", STATE, edge, access)).status, 200);
  const low = await send(t.app, "PUT", STATE, { settings: { ...SETTINGS, uiZoom: 0.5 } }, access);
  assert.equal(pick(low.body, "data.settings.uiZoom"), 0.5);
});

test("two accounts keep separate rows", async () => {
  const t = await makeApp();
  const admin = (await signIn(t.app)).access;
  const ed = await edAccount(t, admin);
  await send(t.app, "PUT", STATE, { settings: SETTINGS }, admin);
  await send(t.app, "PUT", STATE, { shell: SHELL }, ed.token);
  const mine = await send(t.app, "GET", STATE, undefined, admin);
  const theirs = await send(t.app, "GET", STATE, undefined, ed.token);
  assert.deepEqual([pick(mine.body, "data.settings"), pick(mine.body, "data.shell")], [SETTINGS, DEFAULT_SHELL]);
  assert.deepEqual([pick(theirs.body, "data.settings"), pick(theirs.body, "data.shell")], [DEFAULT_SETTINGS, SHELL]);
});

test("deleting an account deletes its row", async () => {
  const t = await makeApp();
  const admin = (await signIn(t.app)).access;
  const ed = await edAccount(t, admin);
  await send(t.app, "PUT", STATE, { settings: SETTINGS }, ed.token);
  const db = new DatabaseSync(path.join(t.dataDir, DATABASE_FILE_NAME));
  const count = (): unknown =>
    pick(db.prepare("SELECT COUNT(*) AS n FROM admin_ui_state WHERE account_id = ?").get(ed.id), "n");
  try {
    assert.equal(count(), 1);
    assert.equal((await send(t.app, "DELETE", `/api/admin-accounts/${ed.id}`, undefined, admin)).status, 200);
    assert.equal(count(), 0);
  } finally {
    db.close();
  }
});

test("both routes answer no-store", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  for (const method of ["GET", "PUT"] as const) {
    const answer = await send(t.app, method, STATE, method === "PUT" ? { settings: SETTINGS } : undefined, access);
    assert.equal(answer.headers["cache-control"], "no-store");
  }
});

test("a stored document that no longer parses is answered as the defaults, never a 500", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  await send(t.app, "PUT", STATE, { shell: SHELL }, access);
  const db = new DatabaseSync(path.join(t.dataDir, DATABASE_FILE_NAME));
  try {
    for (const broken of ['{"theme":"neon"}', "not json"]) {
      db.prepare("UPDATE admin_ui_state SET settings = ?").run(broken);
      const got = await send(t.app, "GET", STATE, undefined, access);
      assert.equal(got.status, 200);
      assert.deepEqual([pick(got.body, "data.settings"), pick(got.body, "data.shell")], [DEFAULT_SETTINGS, SHELL]);
    }
  } finally {
    db.close();
  }
});

test("a state write writes no audit entry", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const entries = async (): Promise<unknown> => {
    const answer = await send(t.app, "GET", "/api/audit?limit=200", undefined, access);
    return pick(answer.body, "data.items");
  };
  const before = pick(await entries(), "length");
  await send(t.app, "PUT", STATE, { settings: SETTINGS, shell: SHELL }, access);
  assert.equal(pick(await entries(), "length"), before);
});
