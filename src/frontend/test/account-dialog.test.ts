import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountControl, accountButtonProps } from "@/components/chrome/AccountControl";
import { AccountDialog, dialogDismisses } from "@/components/chrome/AccountDialog";
import { AccountSignOut } from "@/components/chrome/AccountSignOut";
import { GATE_HEADING } from "@/constants/gate-copy";
import { useAppStore } from "@/store/app-store";

const draw = (element: ReactElement): string => renderToStaticMarkup(element);
const noop = (): void => undefined;

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
    /* SSR renders the store's initial snapshot (zustand v5 serves getInitialState on the server), so the session's
       half is drawn through its presentational panel - the same pure-seam approach the sleeping Theatre button's
       test takes - while the dialog itself proves it mounts that half and not the gate's forms. */
    const panel = draw(createElement(AccountSignOut, { username: "ivy", onDone: noop }));
    assert.ok(panel.includes("Signed in as") && panel.includes("ivy"));
    assert.ok(panel.includes("Sign out"));
    const unknown = draw(createElement(AccountSignOut, { username: null, onDone: noop }));
    assert.ok(!unknown.includes("ivy"), "no username is invented");
    const markup = draw(createElement(AccountDialog, { mode: "session", onClose: noop }));
    assert.ok(markup.includes("Sign out") && markup.includes("Session"));
    assert.ok(!markup.includes("Password"), "the gate's forms are not mounted over a live session");
  });

  it("the control opens it; closed, only the button is there", () => {
    const markup = draw(createElement(AccountControl, { asleep: false }));
    assert.ok(markup.includes("Sign in"));
    assert.ok(!markup.includes('role="dialog"'), "no dialog until the control is pressed");
  });
});
