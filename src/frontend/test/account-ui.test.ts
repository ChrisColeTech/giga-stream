import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountControl, accountButtonProps } from "@/components/chrome/AccountControl";
import { useAppStore } from "@/store/app-store";

const draw = (element: ReactElement): string => renderToStaticMarkup(element);
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the Account icon (`65` section 1)", () => {
  it("is icon-only signed out and signed in, with an accessible tooltip", () => {
    const signedOut = accountButtonProps(false, null, false, () => undefined);
    assert.ok(!draw(createElement("span", {}, signedOut.children)).includes("Sign in"));
    assert.equal(signedOut["aria-label"], "Sign in");
    assert.equal(signedOut.title, "Sign in");
    assert.equal(signedOut["aria-haspopup"], "dialog");
    const signedIn = accountButtonProps(true, "ivy", false, () => undefined);
    assert.ok(!draw(createElement("span", {}, signedIn.children)).includes("ivy"));
    assert.equal(signedIn["aria-label"], "Account for ivy");
  });

  it("asleep under an open work window it is disabled with the sleeping reason", () => {
    const asleep = accountButtonProps(false, null, true, () => undefined);
    assert.equal(asleep.reason, "Close the open window to open the account flow.");
    assert.equal(asleep.title, undefined, "a disabled button carries no title; the reason rides the tooltip");
  });
});

describe("the shared account flows", () => {
  it("the control opens it; closed, only the button is there", () => {
    const markup = draw(createElement(AccountControl, { asleep: false }));
    assert.ok(markup.includes('aria-label="Sign in"'));
    assert.ok(!markup.includes('role="dialog"'), "no dialog until the control is pressed");
  });

  it("uses one PopupPanel with exactly Account and Logout actions, then the ChildWindow profile form", () => {
    const popup = readFileSync("src/components/chrome/AccountPopup.tsx", "utf8");
    const window = readFileSync("src/components/chrome/AccountWindow.tsx", "utf8");
    assert.match(popup, /<PopupPanel/);
    assert.deepEqual([...popup.matchAll(/<Button[^>]*>(Account|Logout)<\/Button>/g)].map((match) => match[1]),
      ["Account", "Logout"]);
    assert.match(popup, /close\(\); open\("account"\)/, "the popup closes before Account opens");
    assert.match(popup, /close\(\); void signOut\(\)/, "Logout closes before invoking its callback");
    for (const primitive of ["ChildWindow", "Toolbar", "Workspace", "Group", "Row", "useProfileUpdate"]) {
      assert.ok(window.includes(primitive), primitive);
    }
    assert.equal((window.match(/>Save<\/Button>/g) ?? []).length, 1);
    assert.ok(window.indexOf("<Toolbar") < window.indexOf("<Workspace"), "the toolbar precedes the scroller");
    assert.match(window, /<Toolbar right=\{[\s\S]*type="submit"[\s\S]*>Save<\/Button>[\s\S]*\} \/>/);
    assert.doesNotMatch(window, /<Group[\s\S]*<Actions>[\s\S]*>Save<\/Button>/,
      "a group never ends with the Save commit");
  });

  it("has no AccountDialog or duplicate Settings Session surface", () => {
    assert.equal(existsSync("src/components/chrome/AccountDialog.tsx"), false);
    assert.equal(existsSync("src/components/settings/SessionSection.tsx"), false);
  });
});
