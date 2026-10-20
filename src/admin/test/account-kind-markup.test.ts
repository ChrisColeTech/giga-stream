import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { AccountsPage } from "@/pages/AccountsPage";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { renderLive, resetStore, signInForTest } from "./support/store";

/* The Accounts kind (`62` section 3.7) as markup: the New form's chips, the list's kind cells and filter select, the
 * workspace's read-only fact row. The rest of the accounts' markup is `accounts-markup.test.ts`. */

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
const strip = (html: string): string => html.slice(html.indexOf('aria-label="Accounts table"'));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New account form's kind choice (`62` section 3.7)", () => {
  it("sits between Username and Password, Admin lit at rest, User beside it", () => {
    const html = page();
    const group = /<div[^>]*role="group"[^>]*aria-label="Kind"[^>]*>[\s\S]*?<\/div>/.exec(html);
    assert.ok(group !== null, "the Kind chips are one labelled group");
    const chips = group[0];
    const chipsAt = html.indexOf(chips);
    assert.ok(at(html, 'aria-label="Username"') < chipsAt, "the username first, the identity");
    assert.ok(chipsAt < at(html, 'aria-label="Password"'), "the Kind choice before the password");
    assert.ok(chips.includes(">Admin</button>") && chips.includes(">User</button>"));
    const adminAt = chips.indexOf(">Admin</button>");
    assert.ok(chips.lastIndexOf('aria-pressed="true"', adminAt) !== -1, "Admin is lit before anything is chosen");
    assert.ok(!chips.slice(adminAt).includes('aria-pressed="true"'), "User is not lit at rest");
  });
});

describe("the list's kind column (`62` section 3.7)", () => {
  it("renders both kinds, an answer without the field as Admin", () => {
    state().accountsLoaded([account("a"), account("b", false, { kind: "admin" }), account("u", false, { kind: "user" })]);
    const html = page();
    const kinds = html.slice(html.indexOf('data-col="kind"'));
    assert.ok(kinds.includes(">Admin<") && kinds.includes(">User<"));
    assert.ok(html.split('data-col="kind"').length - 1 >= 3, "one kind cell per row");
  });

  it("filters with the self-labelling select: Any kind at rest, then Admins, Users, before State", () => {
    state().accountsLoaded([account("a"), account("b")]);
    const table = strip(page());
    const select = /<select[^>]*aria-label="Kind"[^>]*>[\s\S]*?<\/select>/.exec(table);
    assert.ok(select !== null, "the Kind filter sits in the query row");
    assert.deepEqual(
      Array.from(select[0].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g), (option) => [option[1], option[2]]),
      [
        ["any", "Any kind"],
        ["Admin", "Admins"],
        ["User", "Users"],
      ],
    );
    assert.ok(table.indexOf('aria-label="Kind"') < table.indexOf('aria-label="State"'), "the kind filter before the state filter");
    assert.ok(table.includes("Sort by kind"), "the kind column sorts, so the Sort select names it too");
  });
});

describe("the workspace's kind (`62` section 3.7)", () => {
  it("shows the account's kind read-only beside the username, never an editable control", () => {
    state().accountsLoaded([account("a"), account("b")]);
    state().openWorkspace("accounts", "a");
    let html = page();
    const details = html.slice(at(html, 'id="ac-details"'), at(html, 'id="ac-password"'));
    assert.ok(at(details, 'aria-label="About Username"') < at(details, 'aria-label="About Kind"'), "beside the username");
    assert.ok(at(details, 'aria-label="About Kind"') < at(details, 'aria-label="About Enabled"'), "before the Enabled switch");
    assert.ok(details.includes(">Admin<"), "the fact itself, read only");
    assert.ok(!details.includes('aria-label="Kind"'), "no control of the kind: it is a fact, not a field");
    state().accountsLoaded([account("a"), account("u", false, { kind: "user" })]);
    state().openWorkspace("accounts", "u");
    html = page();
    assert.ok(html.slice(at(html, 'id="ac-details"'), at(html, 'id="ac-password"')).includes(">User<"));
  });
});
