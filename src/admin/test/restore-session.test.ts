import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { AppShell } from "@/components/chrome/AppShell";
import { createAuthPort } from "@/services/auth-port";
import { createSessionApi } from "@/services/session-api";
import { useAppStore } from "@/store/app-store";
import { TOKENS, failure, rig, scripted, sessionBody, success } from "./support/fake-backend";
import { renderLive, resetStore } from "./support/store";

const restoring = (backend: ReturnType<typeof scripted>, tokens = null as typeof TOKENS | null) =>
  createAuthPort(createSessionApi(rig(backend.fetch, tokens).deps));
const state = () => useAppStore.getState();
const SIGN_IN_FORM = /Sign in to Giga Stream Admin[\s\S]*type="password"/;

beforeEach(() => resetStore());

describe("the on-load probe", () => {
  it("posts the refresh once with no body and no bearer, and restores the actor and the tokens", async () => {
    const backend = scripted(() => success(sessionBody("a9", "r9", 5000)));
    const session = await restoring(backend).restore();
    assert.deepEqual(backend.calls.map((c) => [c.method, c.url, c.body, c.headers.authorization]), [
      ["POST", "/api/auth/refresh", undefined, undefined],
    ]);
    assert.deepEqual(session?.actor, { id: 7, username: "ada@example.test", securityQuestionSet: false });
    assert.equal(session?.tokens.accessToken, "a9");
  });

  it("answers null on a 401 and on a dead backend", async () => {
    for (const answer of [() => failure(401, "auth.refresh_invalid", "x"), () => Promise.reject(new TypeError("down"))]) {
      assert.equal(await restoring(scripted(answer)).restore(), null);
    }
  });

  it("is one call however many times it is asked: a double mount cannot present the token twice", async () => {
    const backend = scripted(() => success(sessionBody("a9", "r9", 5000)));
    const port = restoring(backend);
    const [one, two] = await Promise.all([port.restore(), port.restore()]);
    assert.equal(backend.calls.length, 1);
    assert.deepEqual(one, two, "the same answer");
  });

  it("sends nothing when a session is already in memory, so it never races that session's refresh", async () => {
    const backend = scripted(() => success(sessionBody("a9", "r9", 5000)));
    assert.equal(await restoring(backend, TOKENS).restore(), null);
    assert.equal(backend.calls.length, 0);
  });
});

describe("the store after the probe", () => {
  it("starts restoring; a restored session shows the shell, once", () => {
    useAppStore.setState({ restoring: true });
    const session = { actor: { id: 7, username: "ada@example.test" }, tokens: TOKENS };
    state().finishRestore(session);
    assert.deepEqual([state().restoring, state().signedIn, state().serial, state().tokens], [false, true, 1, TOKENS]);
    state().finishRestore(session);
    assert.equal(state().serial, 1, "the second answer of a double mount changes nothing");
  });

  it("leaves the gate, signed out and with no notice, when nothing was restored", () => {
    useAppStore.setState({ restoring: true });
    state().finishRestore(null);
    assert.deepEqual([state().restoring, state().signedIn, state().tokens], [false, false, null]);
    assert.deepEqual(state().gate, { phase: "idle", notice: null });
  });
});

describe("the wall while probing", () => {
  it("is a shimmer skeleton with no sign-in form and no text, and the gate returns when the probe says none", () => {
    useAppStore.setState({ restoring: true });
    const html = renderLive(createElement(AppShell));
    assert.match(html, /data-restoring/);
    assert.match(html, /animate-skel-shimmer/);
    assert.doesNotMatch(html, SIGN_IN_FORM);
    useAppStore.setState({ restoring: false });
    assert.match(renderLive(createElement(AppShell)), SIGN_IN_FORM);
  });
});
