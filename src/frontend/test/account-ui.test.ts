import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountControl, accountButtonProps } from "@/components/chrome/AccountControl";
import { accountMenuItems } from "@/hooks/useAccountMenu";
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
    assert.equal(signedIn.title, "Account for ivy");
    assert.equal(signedIn["aria-haspopup"], "menu");
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

  it("uses the standard menu with exactly Account and Logout, then the ChildWindow profile form", () => {
    const calls: string[] = [];
    const rows = accountMenuItems(() => calls.push("account"), () => calls.push("logout"));
    assert.deepEqual(rows.map((row) => row.kind === "action" ? row.label : row.kind), ["Account", "Logout"]);
    for (const row of rows) {
      assert.equal(row.kind, "action");
      if (row.kind === "action") row.onSelect();
    }
    assert.deepEqual(calls, ["account", "logout"]);

    const control = readFileSync("src/components/chrome/AccountControl.tsx", "utf8");
    const hook = readFileSync("src/hooks/useAccountMenu.ts", "utf8");
    const shell = readFileSync("src/components/chrome/AppShell.tsx", "utf8");
    const window = readFileSync("src/components/chrome/AccountWindow.tsx", "utf8");
    assert.match(control, /useAccountMenu\(\)/);
    assert.match(hook, /openMenu\(\{/);
    assert.match(hook, /clientY: box\.bottom/);
    assert.match(shell, /<ContextMenu anchor=\{menu\.anchor\} items=\{menu\.items\} onClose=\{close\} \/>/);
    assert.doesNotMatch(`${control}\n${hook}`, /PopupPanel|AccountPopup|account-popup/);
    assert.equal(existsSync("src/components/chrome/AccountPopup.tsx"), false);
    for (const primitive of ["ChildWindow", "Toolbar", "Workspace", "Group", "Row", "useProfileUpdate"]) {
      assert.ok(window.includes(primitive), primitive);
    }
    assert.equal((window.match(/>Save<\/Button>/g) ?? []).length, 1);
    assert.ok(window.indexOf("<Toolbar") < window.indexOf("<Workspace"), "the toolbar precedes the scroller");
    assert.match(window, /<Toolbar right=\{[\s\S]*type="submit"[\s\S]*>Save<\/Button>[\s\S]*\} \/>/);
    assert.doesNotMatch(window, /<Group[\s\S]*<Actions>[\s\S]*>Save<\/Button>/,
      "a group never ends with the Save commit");
  });

  it("runs each account action through the shared menu's close-before-action queue", () => {
    const menu = readFileSync("../shared/ui/src/menus/ContextMenu.tsx", "utf8");
    const row = readFileSync("../shared/ui/src/menus/ContextMenuRow.tsx", "utf8");
    assert.match(row, /onRun\(row\.onSelect\)/, "a selected row queues rather than directly running its action");
    assert.match(menu, /onRun=\{\(action\) => \(pending\.current = action\)\}/);
    assert.match(menu, /onCloseAutoFocus=\{\(event\) => \{/);
    assert.ok(menu.indexOf("onCloseAutoFocus") < menu.indexOf("flush()"), "the action flush follows menu close");
  });

  it("has no AccountDialog or duplicate Settings Session surface", () => {
    assert.equal(existsSync("src/components/chrome/AccountDialog.tsx"), false);
    assert.equal(existsSync("src/components/settings/SessionSection.tsx"), false);
  });
});
