import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_EMAIL, DEMO_PASSWORD, LOCKED_EMAIL, OFFLINE_EMAIL, fixtureAuthPort } from "@/fixtures/auth-port";
import { authPort } from "@/services/auth";

describe("the fixture auth port", () => {
  it("is the port the app uses until Wave 7", () => {
    assert.equal(authPort, fixtureAuthPort);
  });

  it("accepts exactly the demo pair, with the email trimmed and not case sensitive", async () => {
    const result = await fixtureAuthPort.signIn(` ${DEMO_EMAIL.toUpperCase()} `, DEMO_PASSWORD);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.session.actor, { email: DEMO_EMAIL, name: "Ada" });
  });

  it("refuses a wrong password, a wrong email and an empty pair as `invalid`", async () => {
    for (const [email, password] of [
      [DEMO_EMAIL, "wrong"],
      [DEMO_EMAIL, DEMO_PASSWORD.toUpperCase()],
      ["ed@example.test", DEMO_PASSWORD],
      ["", ""],
    ] as const) {
      assert.deepEqual(await fixtureAuthPort.signIn(email, password), { ok: false, refusal: "invalid" }, email);
    }
  });

  it("answers `locked` for the locked address, whatever the password", async () => {
    assert.deepEqual(await fixtureAuthPort.signIn(LOCKED_EMAIL, DEMO_PASSWORD), { ok: false, refusal: "locked" });
    assert.deepEqual(await fixtureAuthPort.signIn(LOCKED_EMAIL, "x"), { ok: false, refusal: "locked" });
  });

  it("answers `unreachable` for the offline address", async () => {
    assert.deepEqual(await fixtureAuthPort.signIn(OFFLINE_EMAIL, "x"), { ok: false, refusal: "unreachable" });
  });

  it("signs out without rejecting", async () => {
    assert.equal(await fixtureAuthPort.signOut(), undefined);
  });
});
