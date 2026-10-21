import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { SECURITY_QUESTIONS, SECURITY_QUESTION_OPTIONS } from "@/constants/security-questions";
import { NOTHING_CHANGED } from "@/constants/record-copy";
import { AccountsPage } from "@/pages/AccountsPage";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const account = (id: string | number, disabled = false, extra: Partial<AdminAccount> = {}): AdminAccount => ({
  id,
  username: `${id}@x.test`,
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
  it("has Username then Password and no Name, as text and new-password, with no placeholder", () => {
    const html = page();
    assert.ok(!html.includes('aria-label="Name"'));
    assert.ok(at(html, 'aria-label="Username"') < at(html, 'aria-label="Password"'));
    assert.ok(!html.includes('type="email"') && html.includes('type="password"'));
    assert.ok(html.includes('autoComplete="new-password"'));
    assert.ok(!html.includes('placeholder="') && !html.includes("Role"));
    assert.ok(html.includes("New account"));
  });

  it("disables Create with the first missing field's reason", () => {
    assert.ok(page().includes('aria-label="Create. Username is required."'));
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
    for (const heading of [">username<", ">kind<", ">state<", ">last sign-in<"]) assert.ok(html.includes(heading), heading);
    assert.ok(!html.includes(">name<"));
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

describe("the accounts table strip", () => {
  const strip = (html: string): string => html.slice(html.indexOf('aria-label="Accounts table"'));

  it("holds Refresh first, in the strip and not in the heading, and every verb drawn and waiting for a tick", () => {
    state().accountsLoaded([account("a"), account("b")]);
    const html = page();
    const table = strip(html);
    assert.ok(table.includes('title="Refresh accounts"') && table.includes("Refresh</button>"));
    assert.ok(html.indexOf('aria-label="Accounts table"') > html.indexOf(">Accounts</h2>"));
    for (const verb of ["Enable", "Disable", "Delete"]) assert.ok(table.includes(`aria-label="${verb}. Tick `), verb);
    assert.ok(table.includes('aria-label="Select all accounts"') && table.includes('aria-checked="false"'));
    assert.ok(!table.includes("selected<") && !table.includes("Clear selection"));
  });

  it("draws the three-state All in the header's tick cell, above the row ticks, not in the strip", () => {
    state().accountsLoaded([account("a"), account("b")]);
    const html = page();
    const strip = html.slice(html.indexOf('role="toolbar"'), html.indexOf("</div>", html.indexOf('role="toolbar"')));
    assert.ok(!strip.includes("Select all accounts"));
    const all = html.indexOf('aria-label="Select all accounts"');
    assert.ok(all > html.indexOf('aria-label="Accounts table"') && all < html.indexOf('aria-label="Select a@x.test"'));
    assert.ok(all < html.indexOf(">username<"));
  });

  it("enables the verbs for ticked rows with no count text, and refuses the signed-in account with its reason", () => {
    state().accountsLoaded([account(7), account("b"), account("c")]);
    state().accountTick("b", true);
    let table = strip(page());
    assert.ok(!table.includes("1</span> selected") && table.includes('aria-checked="mixed"'));
    assert.ok(table.includes("Enable</button>") && table.includes("Disable</button>"));
    assert.ok(table.includes(">Delete</button>") && !table.includes("Clear selection"));
    assert.ok(!table.includes("Tick an account first"));
    state().accountTick("b", false);
    state().accountTick(7, true);
    table = strip(page());
    assert.ok(table.includes('aria-label="Disable. Your own account cannot be disabled here."'));
    assert.ok(table.includes('aria-label="Delete. Your own account cannot be deleted here."'));
  });
});

describe("an account's workspace", () => {
  it("opens from the held list with the rail, Details, Password, Security question, Discard left and the ONE Save right", () => {
    state().accountsLoaded([account("a"), account("b")]);
    state().openWorkspace("accounts", "a");
    const html = page();
    assert.ok(html.includes('aria-label="Account sections"') && html.includes("Accounts"));
    assert.ok(at(html, ">Details<") < at(html, ">Password<"));
    assert.ok(at(html, ">Password<") < at(html, ">Security question<"), "the rail lists the question group last");
    assert.ok(!html.includes('aria-label="Name"') && html.includes('aria-label="Username"'));
    assert.ok(html.includes('role="switch"') && html.includes('aria-checked="true"'));
    assert.ok(!html.includes("Titles →"));
    assert.ok(html.includes('aria-label="Discard changes. Nothing has changed."'));
    const bar = html.slice(at(html, 'role="toolbar"'), at(html, 'id="ac-details"'));
    assert.ok(bar.includes("Discard changes") && !bar.includes("→"), "the page toolbar: Discard, no forward verb");
    assert.ok(bar.indexOf("Discard changes") < bar.indexOf("min-w-0 flex-1"), "Discard left");
    assert.ok(bar.indexOf("min-w-0 flex-1") < bar.indexOf(`aria-label="Save. ${NOTHING_CHANGED}"`), "the ONE Save right");
    assert.ok(
      !html.includes("Save details") && !html.includes("Save question"),
      "no save on the form; the toolbar's Save commits the entire record (`55` decision 5)",
    );
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

describe("the Security question group", () => {
  const open = (): string => {
    state().accountsLoaded([account("a"), account("b")]);
    state().openWorkspace("accounts", "a");
    return page();
  };

  it("is the workspace's last group, after Password, holding the draft the ONE Save commits; no verb of its own", () => {
    const html = open();
    assert.ok(at(html, 'id="ac-password"') < at(html, 'id="ac-question"'));
    assert.ok(at(html, 'aria-label="Answer"') < at(html, "</form>"), "the rows are the group's body");
    assert.ok(!html.includes("Save question"), "`Save question` is deleted; the toolbar's Save commits it");
  });

  it("offers the backend's eight questions, in its order, numbered 1 to 8", () => {
    const backend = readFileSync(new URL("../../backend/src/constants/security-questions.ts", import.meta.url), "utf8");
    const listed = Array.from(backend.matchAll(/^ {2}"(.+)",$/gm), (match) => match[1]);
    assert.deepEqual([...SECURITY_QUESTIONS], listed);
    assert.deepEqual(SECURITY_QUESTION_OPTIONS.map((option) => option.value), [1, 2, 3, 4, 5, 6, 7, 8]);
    const html = open();
    for (const question of SECURITY_QUESTIONS) assert.ok(html.includes(question.replace("'", "&#x27;")), question);
  });

  it("has the Answer row after the question, typed in clear, kept off autocomplete, with no placeholder", () => {
    const html = open();
    assert.ok(at(html, 'aria-label="Security question"') < at(html, 'aria-label="Answer"'));
    assert.ok(html.includes("<select") && html.includes('autoComplete="off"'));
    /* The kit Input renders its class first, then the spread props, so `type` sits between `class` and `aria-label`;
       the tag is pinned whole, not sliced from the label. */
    assert.ok(/<input[^>]*type="text"[^>]*aria-label="Answer"/.test(html), "the answer is typed in clear");
    assert.ok(!/\splaceholder=/.test(html) && !html.includes("aria-disabled"));
  });

  it("carries the account's flag as its badge both ways, and Details has no fact row", () => {
    const html = open();
    const details = html.slice(at(html, 'id="ac-details"'), at(html, 'id="ac-password"'));
    assert.ok(!details.includes("Security question"), "the fact row moved to the group's badge");
    assert.ok(html.includes("Not set"));
    state().accountsLoaded([account("a", false, { securityQuestionSet: true }), account("b")]);
    const set = page();
    assert.ok(set.includes(">Set<") && !set.includes("Not set"), "the badge flips with the flag");
  });
});
