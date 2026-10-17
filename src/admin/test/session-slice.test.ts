import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SESSION_ENDED_NOTICE } from "@/constants/sign-in-copy";
import { DEMO_EMAIL, DEMO_PASSWORD, fixtureAuthPort } from "@/fixtures/auth-port";
import { useAppStore } from "@/store/app-store";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();

/** What the hook does, without React: mark submitting, await the port, hand the answer to the store. */
async function signInWith(email: string, password: string): Promise<void> {
  state().beginSignIn();
  state().finishSignIn(await fixtureAuthPort.signIn(email, password));
}

beforeEach(() => {
  resetStore();
  state().signOut();
});

describe("the session slice", () => {
  it("goes signed out -> signed in -> signed out", async () => {
    assert.equal(state().signedIn, false);
    assert.equal(state().actor, null);
    await signInWith(DEMO_EMAIL, DEMO_PASSWORD);
    assert.equal(state().signedIn, true);
    assert.equal(state().actor?.email, DEMO_EMAIL);
    assert.deepEqual(state().gate, { phase: "idle", notice: null });
    assert.ok(state().events.length > 0, "the audit tail is read after sign-in");
    state().signOut();
    assert.equal(state().signedIn, false);
    assert.equal(state().actor, null);
    assert.deepEqual(state().events, []);
  });

  it("waits while submitting: the gate says so and nobody is signed in yet", () => {
    state().beginSignIn();
    assert.deepEqual(state().gate, { phase: "submitting" });
    assert.equal(state().signedIn, false);
  });

  it("keeps the user on the gate with the sentence after a refusal", async () => {
    await signInWith(DEMO_EMAIL, "wrong");
    assert.equal(state().signedIn, false);
    assert.equal(state().actor, null);
    assert.deepEqual(state().gate, { phase: "refused", sentence: "The email or password is wrong." });
  });

  it("keeps the user on the gate for a locked account and for an unreachable backend", async () => {
    await signInWith("locked@example.test", "x");
    assert.equal(state().gate.phase, "locked");
    await signInWith("offline@example.test", "x");
    assert.equal(state().gate.phase, "unreachable");
    assert.equal(state().signedIn, false);
  });

  it("can try again after a refusal and then get in", async () => {
    await signInWith(DEMO_EMAIL, "wrong");
    await signInWith(DEMO_EMAIL, DEMO_PASSWORD);
    assert.equal(state().signedIn, true);
    assert.deepEqual(state().gate, { phase: "idle", notice: null });
  });

  it("ignores an answer that arrives with nothing waiting for it", async () => {
    state().finishSignIn(await fixtureAuthPort.signIn(DEMO_EMAIL, DEMO_PASSWORD));
    assert.equal(state().signedIn, false);
  });

  it("returns to the gate with a notice when the session ends under the app, and forgets the account", async () => {
    await signInWith(DEMO_EMAIL, DEMO_PASSWORD);
    state().openOverlay("settings");
    state().endSession(SESSION_ENDED_NOTICE);
    assert.equal(state().signedIn, false);
    assert.equal(state().actor, null);
    assert.equal(state().overlay, null);
    assert.deepEqual(state().gate, { phase: "idle", notice: SESSION_ENDED_NOTICE });
  });

  it("signing out leaves no notice and no error behind", async () => {
    await signInWith(DEMO_EMAIL, "wrong");
    state().signOut();
    assert.deepEqual(state().gate, { phase: "idle", notice: null });
  });
});
