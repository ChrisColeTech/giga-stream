import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountControl, accountButtonProps } from "@/components/chrome/AccountControl";
import { AccountDialog, dialogDismisses } from "@/components/chrome/AccountDialog";
import { AccountSignOut } from "@/components/chrome/AccountSignOut";
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

  it("signed out it defers to the wall: the gate's forms live in the full-screen gate, not here", () => {
    const markup = draw(createElement(AccountDialog, { session: null, onGate: noop, onClose: () => undefined }));
    assert.ok(markup.includes('role="dialog"') && markup.includes('aria-modal="true"'));
    assert.ok(markup.includes("Open the full-screen gate"), "the signed-out dialog is a handoff to the wall");
    assert.ok(!markup.includes("Password"), "the gate's forms are not mounted here");
    assert.ok(!markup.includes("bg-scrim"), "the backdrop cannot close the signed-out dialog; the wall owns dismissal");
  });

  it("signed in it mounts the session's sign-out instead", () => {
    /* The dialog is presentational - it takes the session as a prop, the same pure-seam seam the sign-out panel
       takes its username with - so the signed-in half draws deterministically here, no store seeding: SSR would
       render the store's initial snapshot and a mid-test write never reaches it. */
    const panel = draw(createElement(AccountSignOut, { username: "ivy", onDone: noop }));
    assert.ok(panel.includes("Signed in as") && panel.includes("ivy"));
    assert.ok(panel.includes("Sign out"));
    const unknown = draw(createElement(AccountSignOut, { username: null, onDone: noop }));
    assert.ok(!unknown.includes("ivy"), "no username is invented");
    const markup = draw(
      createElement(AccountDialog, {
        session: { id: "acc-1", username: "ivy", kind: "user" },
        onGate: noop,
        onClose: noop,
      }),
    );
    assert.ok(markup.includes("Sign out") && markup.includes("Session"));
    assert.ok(!markup.includes("Password"), "the gate's forms are not mounted over a live session");
    assert.ok(!markup.includes("Open the full-screen gate"), "the handoff is a signed-out state only");
  });

  it("the control opens it; closed, only the button is there", () => {
    const markup = draw(createElement(AccountControl, { asleep: false }));
    assert.ok(markup.includes("Sign in"));
    assert.ok(!markup.includes('role="dialog"'), "no dialog until the control is pressed");
  });
});
