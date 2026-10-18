import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SESSION_ENDED_NOTICE } from "@/constants/sign-in-copy";
import { useAppStore } from "@/store/app-store";
import type { AuthSession } from "@/types/auth";
import { ACCOUNT, TOKENS } from "./support/fake-backend";
import { resetStore } from "./support/store";

const session: AuthSession = { actor: { id: 7, username: "ada@example.test", name: "Ada" }, tokens: TOKENS };
const state = () => useAppStore.getState();
const signIn = (): void => {
  state().beginSignIn();
  state().finishSignIn({ ok: true, session });
};

beforeEach(() => resetStore());

describe("the session slice, finished", () => {
  it("stores the actor with its id and raises the serial at every sign-in", () => {
    assert.equal(state().serial, 0);
    signIn();
    assert.deepEqual(state().actor, { id: 7, username: "ada@example.test", name: "Ada" });
    assert.equal(state().serial, 1);
    state().signOut();
    signIn();
    assert.equal(state().serial, 2);
  });

  it("follows the account's own username and name through updateActor, keeping the id", () => {
    signIn();
    state().updateActor({ id: 7, username: "ada@new.test", name: "Ada L" });
    assert.deepEqual(state().actor, { id: 7, username: "ada@new.test", name: "Ada L" });
    state().signOut();
    state().updateActor({ id: 7, username: "x@y.test", name: "X" });
    assert.equal(state().actor, null, "nothing to update when signed out");
  });

  it("leaves a second beginSignIn while submitting unchanged", () => {
    state().beginSignIn();
    const gate = state().gate;
    state().beginSignIn();
    assert.equal(state().gate, gate);
  });

  it("clears accounts, audit rows, events and the stale marks when the session ends or the user signs out", () => {
    for (const leave of [() => state().endSession(SESSION_ENDED_NOTICE), () => state().signOut()]) {
      signIn();
      state().accountsLoaded([{ ...ACCOUNT, id: "acct_1" }]);
      state().markStale("jobs");
      useAppStore.setState({
        events: [{ id: "audit-1", at: 1, tone: "info", area: "Account", sentence: "x" }],
        olderCursor: 5,
      });
      state().say("Careful.", "warn");
      leave();
      assert.equal(state().accounts.status, "idle");
      assert.deepEqual(state().accounts.items, []);
      assert.equal(state().stale.jobs, false);
      assert.deepEqual([state().events, state().olderCursor], [[], null]);
    }
  });

  it("says the session ended on the gate, and nothing on a plain sign-out", () => {
    signIn();
    state().endSession(SESSION_ENDED_NOTICE);
    assert.deepEqual(state().gate, { phase: "idle", notice: SESSION_ENDED_NOTICE });
    signIn();
    state().signOut();
    assert.deepEqual(state().gate, { phase: "idle", notice: null });
  });
});
