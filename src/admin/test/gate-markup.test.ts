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
  it("is a region of the shell, not a modal, with the brand column beside the form", () => {
    const html = page();
    assert.ok(html.includes('role="region"') && !html.includes("aria-modal"));
    assert.ok(html.indexOf("Run the channels.") < html.indexOf('aria-label="Sign in"'));
    assert.ok(html.includes("STREAM ADMIN"));
  });

  it("has Email then Password with the autocomplete attributes, and no placeholder", () => {
    const html = form();
    assert.ok(html.indexOf('aria-label="Email"') < html.indexOf('aria-label="Password"'));
    assert.ok(html.includes('type="email"') && html.includes('autoComplete="username"'));
    assert.ok(html.includes('type="password"') && html.includes('autoComplete="current-password"'));
    assert.ok(!/\splaceholder=/.test(html));
  });

  it("disables `Sign in` with its reason while the fields are empty", () => {
    const html = form();
    assert.ok(html.includes('aria-label="Sign in. Enter your email and password."'));
    assert.ok(submitButton(html).includes('disabled=""'));
    assert.ok(!html.includes('role="alert"'));
  });

  it("offers no OAuth, no forgot password, no sign-up and no password toggle", () => {
    const html = page().toLowerCase();
    for (const word of ["google", "github", "oauth", "forgot", "create an account", "sign up", "show password"]) {
      assert.ok(!html.includes(word), word);
    }
  });
});

describe("the gate, submitting", () => {
  it("disables both fields and the verb, which says it is waiting", () => {
    gateAt({ phase: "submitting" });
    const html = form();
    assert.equal(html.split("disabled=\"\"").length - 1, 3, "email, password and the verb");
    assert.ok(html.includes("Signing in") && html.includes("animate-pulse-busy"));
    assert.ok(html.includes("Waiting for the answer."));
  });
});

describe("the gate, refused", () => {
  it("shows the sentence under the Password row as an alert and marks the field invalid", () => {
    gateAt({ phase: "refused", sentence: "The email or password is wrong." });
    const html = form();
    assert.ok(html.includes('role="alert"') && html.includes("The email or password is wrong."));
    assert.ok(html.indexOf('aria-label="Password"') < html.indexOf("The email or password is wrong."));
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
