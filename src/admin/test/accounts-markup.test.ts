import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { AccountsPage } from "@/pages/AccountsPage";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const account = (id: string | number, disabled = false, extra: Partial<AdminAccount> = {}): AdminAccount => ({
  id,
  username: `${id}@x.test`,
  name: `Name ${id}`,
  disabled,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const page = (): string => renderLive(createElement(AccountsPage, { active: true }));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New account form", () => {
  it("has Name, Username and Password in that order, as text and new-password, with no placeholder", () => {
    const html = page();
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Username"'));
    assert.ok(at(html, 'aria-label="Username"') < at(html, 'aria-label="Password"'));
    assert.ok(!html.includes('type="email"') && html.includes('type="password"'));
    assert.ok(html.includes('autoComplete="new-password"'));
    assert.ok(!html.includes('placeholder="') && !html.includes("Role"));
    assert.ok(html.includes("New account"));
  });

  it("disables Create with the first missing field's reason", () => {
    assert.ok(page().includes('aria-label="Create. Name is required."'));
  });
});

describe("the accounts list", () => {
  it("draws shimmer rows while nothing is read, with no sentence over them", () => {
    const html = page();
    assert.ok(html.includes("animate-skel-shimmer"));
    assert.ok(html.includes("Select all accounts"));
    assert.ok(!html.includes("No accounts") && !html.includes("@x.test"));
  });

  it("shows the headings, ticks, state words, a dimmed disabled row and `never`", () => {
    state().accountsLoaded([account("a", false, { lastSignInAt: new Date(2026, 9, 17, 9, 5).getTime() }), account("b"), account("off", true)]);
    const html = page();
    for (const heading of [">username<", ">name<", ">state<", ">last sign-in<"]) assert.ok(html.includes(heading), heading);
    for (const label of ["Select all accounts", "Select a@x.test", "Select off@x.test"]) assert.ok(html.includes(`aria-label="${label}"`), label);
    assert.ok(html.includes('data-st="enabled"') && html.includes('data-st="disabled"'));
    assert.equal(html.split("opacity-45").length - 1 >= 1, true, "the disabled row is dimmed");
    assert.ok(html.includes("2026-10-17 09:05") && html.includes(">never<"));
  });

  it("disables the last enabled account's Delete with its reason, and titles the others at rest", () => {
    state().accountsLoaded([account("a"), account("off", true)]);
    let html = page();
    assert.ok(/<button[^>]*disabled=""[^>]*title="The last enabled account cannot be deleted\."/.test(html));
    state().accountsLoaded([account("a"), account("b"), account("off", true)]);
    html = page();
    assert.ok(html.includes('title="Deletes the account and ends its sessions."'));
    assert.ok(!html.includes("The last enabled account cannot be deleted."));
  });

  it("disables Delete with the unreachable sentence after a transport failure", () => {
    state().accountsLoaded([account("a"), account("b")]);
    state().accountsMarkUnreachable(true);
    assert.ok(page().includes('title="The admin backend cannot be reached."'));
  });
});

describe("the bulk toolbar", () => {
  it("offers Enable, Disable and Delete, each disabled with `Tick an account first` until something is ticked", () => {
    state().accountsLoaded([account("a"), account("b")]);
    const html = page();
    for (const verb of ["Enable", "Disable"]) assert.ok(html.includes(`aria-label="${verb}. Tick an account first"`), verb);
    assert.ok(html.includes('title="Tick an account first"'), "Delete is the armed two-step");
  });

  it("arms the verbs for ticked rows, and refuses the signed-in account with its reason", () => {
    state().accountsLoaded([account(7), account("b"), account("c")]);
    state().accountTick("b", true);
    let html = page();
    assert.ok(html.includes(">Disable</button>") && html.includes(">Delete</button>"));
    assert.ok(!html.includes("Tick an account first"));
    state().accountTick("b", false);
    state().accountTick(7, true);
    html = page();
    assert.ok(html.includes('aria-label="Disable. Your own account cannot be disabled here."'));
    assert.ok(html.includes('title="Your own account cannot be deleted here."'));
  });
});

describe("an account's workspace", () => {
  it("opens from the held list with the rail, Details, Password and a toolbar of Discard and Save only", () => {
    state().accountsLoaded([account("a"), account("b")]);
    state().openWorkspace("accounts", "a");
    const html = page();
    assert.ok(html.includes('aria-label="Account sections"') && html.includes("Accounts"));
    assert.ok(at(html, ">Details<") < at(html, ">Password<"));
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Username"'));
    assert.ok(html.includes("Security question") && html.includes("Not set"), "the read-only fact");
    assert.ok(html.includes('role="switch"') && html.includes('aria-checked="true"'));
    assert.ok(html.includes("Discard changes") && html.includes(">Save<") && !html.includes("Titles →"));
    assert.ok(html.includes('aria-label="Discard changes. Nothing has changed."'));
    assert.ok(html.includes('autoComplete="new-password"'));
    assert.ok(html.includes('aria-label="Set new password. Type a new password."'));
  });

  it("disables the Enabled switch with its reason while this is the last enabled account", () => {
    state().accountsLoaded([account("a"), account("off", true)]);
    state().openWorkspace("accounts", "a");
    assert.ok(page().includes('aria-label="Enabled. The last enabled account cannot be disabled."'));
    state().accountsLoaded([account("a"), account("b")]);
    assert.ok(!page().includes("cannot be disabled"));
  });

  it("shows an account that never signed in as `never`", () => {
    state().accountsLoaded([account("a")]);
    state().openWorkspace("accounts", "a");
    assert.ok(page().includes(">never<"));
  });
});
