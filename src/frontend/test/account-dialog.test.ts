import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountControl, accountButtonProps } from "@/components/chrome/AccountControl";
import { AccountDialog, dialogDismisses } from "@/components/chrome/AccountDialog";
import { GATE_HEADING } from "@/constants/gate-copy";
import { useAppStore } from "@/store/app-store";

const draw = (element: ReactElement): string => renderToStaticMarkup(element);

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the Account control's button (`06` section 2, `63` section 3.5)", () => {
  it("signed out it is a ghost Sign in; signed in it names the account", () => {
    const signedOut = accountButtonProps(false, null, false, () => undefined);
    assert.equal(signedOut.variant, "ghost");
    assert.ok(draw(createElement("span", {}, signedOut.children)).includes("Sign in"));
    assert.equal(signedOut["aria-haspopup"], "dialog");
    const signedIn = accountButtonProps(true, "ivy", false, () => undefined);
    assert.ok(draw(createElement("span", {}, signedIn.children)).includes("ivy"));
    assert.ok(!draw(createElement("span", {}, signedIn.children)).includes("Sign in"));
  });

  it("asleep under an open work window it is disabled with the sleeping reason", () => {
    const asleep = accountButtonProps(false, null, true, () => undefined);
    assert.equal(asleep.reason, "Close the open window to open the account dialog.");
    assert.equal(asleep.title, undefined, "a disabled button carries no title; the reason rides the tooltip");
  });
});

describe("the Account dialog (`63` sections 3.1 and 3.5)", () => {
  it("Escape closes it; no other key does", () => {
    assert.equal(dialogDismisses("Escape"), true);
    assert.equal(dialogDismisses("Enter"), false);
    assert.equal(dialogDismisses("Tab"), false);
  });

  it("signed out it mounts the gate's own forms: sign in, with the forgot-password flow beside it", () => {
    const markup = draw(createElement(AccountDialog, { mode: "gate", onClose: () => undefined }));
    assert.ok(markup.includes('role="dialog"') && markup.includes('aria-modal="true"'));
    assert.ok(markup.includes(GATE_HEADING));
    assert.ok(markup.includes("Username") && markup.includes("Password"));
    assert.ok(markup.includes("Forgot password?"), "the reset flow rides the same dialog");
    assert.ok(markup.includes("bg-scrim"), "the family backdrop closes it");
  });

  it("signed in it mounts the session's sign-out instead", () => {
    useAppStore.setState({ signedIn: true, session: { id: "acc-1", username: "ivy", kind: "user" } });
    const markup = draw(createElement(AccountDialog, { mode: "session", onClose: () => undefined }));
    assert.ok(markup.includes("Signed in as") && markup.includes("ivy"));
    assert.ok(markup.includes("Sign out"));
    assert.ok(!markup.includes("Password"), "the gate's forms are not mounted over a live session");
  });

  it("the control opens it; closed, only the button is there", () => {
    const markup = draw(createElement(AccountControl, { asleep: false }));
    assert.ok(markup.includes("Sign in"));
    assert.ok(!markup.includes('role="dialog"'), "no dialog until the control is pressed");
  });
});
