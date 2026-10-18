import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { SignInForm } from "@/components/session/SignInForm";
import { SESSION_ENDED_NOTICE } from "@/constants/sign-in-copy";
import type { GateState } from "@/lib/gate-state";
import { SignInPage } from "@/pages/SignInPage";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore } from "./support/store";

const gateAt = (gate: GateState): void => useAppStore.setState({ signedIn: false, actor: null, gate });
const page = (): string => renderLive(createElement(SignInPage));
const form = (): string => renderLive(createElement(SignInForm));
const submitButton = (html: string): string => html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";

beforeEach(() => {
  resetStore();
  gateAt({ phase: "idle", notice: null });
});

describe("the gate, idle", () => {
  it("is a full-window wall with a drag strip, and the brand column beside the form", () => {
    const html = page();
    assert.ok(html.includes('role="dialog"') && html.includes('aria-modal="true"'));
    assert.ok(html.includes("fixed inset-0") && html.includes("[-webkit-app-region:drag]"));
    assert.ok(html.indexOf("Run the channels.") < html.indexOf('aria-label="Sign in"'));
    assert.ok(html.includes("STREAM ADMIN"));
  });

  it("has Username then Password with the autocomplete attributes, and no placeholder", () => {
    const html = form();
    assert.ok(html.indexOf('aria-label="Username"') < html.indexOf('aria-label="Password"'));
    assert.ok(!html.includes('type="email"') && html.includes('autoComplete="username"'));
    assert.ok(html.includes('type="password"') && html.includes('autoComplete="current-password"'));
    assert.ok(!/\splaceholder=/.test(html));
  });

  it("disables `Sign in` with its reason while the fields are empty", () => {
    const html = form();
    assert.ok(html.includes('aria-label="Sign in. Enter your username and password."'));
    assert.ok(submitButton(html).includes('disabled=""'));
    assert.ok(!html.includes('role="alert"'));
  });

  it("offers no OAuth, no sign-up and no password toggle, and one `Forgot password?` link under the Password row", () => {
    const html = page().toLowerCase();
    for (const word of ["google", "github", "oauth", "create an account", "sign up", "show password"]) {
      assert.ok(!html.includes(word), word);
    }
    const link = page();
    assert.equal(link.split("Forgot password?").length - 1, 1);
    assert.ok(link.indexOf('aria-label="Password"') < link.indexOf("Forgot password?"));
    assert.ok(link.indexOf("Forgot password?") < link.indexOf('type="submit"'));
  });
});

describe("the gate, submitting", () => {
  it("disables both fields and the verb, which says it is waiting", () => {
    gateAt({ phase: "submitting" });
    const html = form();
    assert.equal(html.split("disabled=\"\"").length - 1, 3, "username, password and the verb");
    assert.ok(html.includes("Signing in") && html.includes("animate-pulse-busy"));
    assert.ok(html.includes("Waiting for the answer."));
  });
});

describe("the gate, refused", () => {
  it("shows the sentence under the Password row as an alert and marks the field invalid", () => {
    gateAt({ phase: "refused", sentence: "The username or password is wrong." });
    const html = form();
    assert.ok(html.includes('role="alert"') && html.includes("The username or password is wrong."));
    assert.ok(html.indexOf('aria-label="Password"') < html.indexOf("The username or password is wrong."));
    assert.ok(html.includes('aria-invalid="true"'));
    assert.ok(!html.includes("Signing in"));
  });

  it("shows a lock and an unreachable backend the same way", () => {
    gateAt({ phase: "locked", sentence: "This account is locked for a while after failed sign-ins." });
    assert.ok(form().includes("This account is locked for a while after failed sign-ins."));
    gateAt({ phase: "unreachable", sentence: "The admin backend cannot be reached." });
    assert.ok(form().includes("The admin backend cannot be reached."));
  });
});

describe("the gate after a session ended", () => {
  it("shows the notice card above the form, and no error", () => {
    gateAt({ phase: "idle", notice: SESSION_ENDED_NOTICE });
    const html = page();
    assert.ok(html.includes('role="status"') && html.includes(SESSION_ENDED_NOTICE));
    assert.ok(html.indexOf(SESSION_ENDED_NOTICE) < html.indexOf('aria-label="Sign in"'));
    assert.ok(!html.includes('role="alert"'));
  });

  it("shows no card for a plain sign-out", () => {
    assert.ok(!page().includes('role="status"'));
  });
});
