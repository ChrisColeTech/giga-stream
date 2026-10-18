import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAST_ACCOUNT } from "@/constants/record-copy";
import { createBody, passwordBody } from "@/lib/account-body";
import { createReason, emailAddress, firstCreateRefusal, firstSaveRefusal, nameLength, passwordLength } from "@/lib/account-checks";
import { changedFields, draftOf, isEmptyPatch, sameAccountDraft } from "@/lib/account-draft";
import { deleteReason, disableReason, isLastEnabled } from "@/lib/account-guard";
import { accountRow, selectAllState } from "@/lib/account-rows";
import { formatWhen } from "@/lib/format-when";
import type { AdminAccount } from "@/types/admin-account";

const account = (id: string, disabled = false, extra: Partial<AdminAccount> = {}): AdminAccount => ({
  id,
  email: `${id}@x.test`,
  name: id.toUpperCase(),
  disabled,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const FREE = { unreachable: false, busy: false };

describe("the last-enabled guard", () => {
  it("refuses Delete and disabling for the only enabled account, with their reasons", () => {
    const items = [account("a"), account("b", true)];
    assert.equal(isLastEnabled(items, items[0] as AdminAccount), true);
    assert.equal(deleteReason(items, items[0] as AdminAccount, FREE), LAST_ACCOUNT);
    assert.equal(disableReason(items, items[0] as AdminAccount), "The last enabled account cannot be disabled.");
  });

  it("allows both while two accounts are enabled, and always allows deleting a disabled one", () => {
    const items = [account("a"), account("b"), account("c", true)];
    assert.equal(deleteReason(items, items[0] as AdminAccount, FREE), undefined);
    assert.equal(disableReason(items, items[1] as AdminAccount), undefined);
    const lone = [account("a"), account("c", true)];
    assert.equal(deleteReason(lone, lone[1] as AdminAccount, FREE), undefined);
    assert.equal(disableReason(lone, lone[1] as AdminAccount), undefined, "turning an account on is never refused");
  });

  it("disables Delete with the unreachable sentence or while a call runs", () => {
    const items = [account("a"), account("b")];
    assert.equal(deleteReason(items, items[0] as AdminAccount, { unreachable: true, busy: false }), "The admin backend cannot be reached.");
    assert.equal(deleteReason(items, items[0] as AdminAccount, { unreachable: false, busy: true }), "Saving.");
  });
});

describe("the drafts", () => {
  const saved = account("a", false, { name: "Ann" });

  it("makes Enabled the inverse of disabled, and is dirty by value", () => {
    assert.deepEqual(draftOf(saved), { name: "Ann", email: "a@x.test", enabled: true });
    assert.deepEqual(draftOf(account("b", true)).enabled, false);
    assert.equal(sameAccountDraft(draftOf(saved), { ...draftOf(saved), enabled: false }), false);
  });

  it("sends only the changed fields, trimmed", () => {
    assert.ok(isEmptyPatch(changedFields(saved, draftOf(saved))));
    assert.deepEqual(changedFields(saved, { name: " Bea ", email: "a@x.test", enabled: false }), { name: "Bea", disabled: true });
    assert.deepEqual(changedFields(account("d", true), { ...draftOf(account("d", true)), enabled: true }), { disabled: false });
  });

  it("builds the create body with the password untouched", () => {
    assert.deepEqual(createBody({ name: " N ", email: " e@x.test ", password: " p " }), { email: "e@x.test", name: "N", password: " p " });
    assert.deepEqual(passwordBody(" p "), { password: " p " });
  });
});

describe("the field checks", () => {
  it("names the first missing field, in the form's order: Name, Email, Password", () => {
    assert.equal(createReason({ name: "", email: "", password: "" }, false, false), "Name is required.");
    assert.equal(createReason({ name: "N", email: " ", password: "" }, false, false), "Email is required.");
    assert.equal(createReason({ name: "N", email: "e@x.test", password: "" }, false, false), "Password is required.");
    const full = { name: "N", email: "e@x.test", password: "x".repeat(12) };
    assert.equal(createReason(full, false, false), undefined);
    assert.equal(createReason(full, true, false), "Saving.");
    assert.equal(createReason(full, false, true), "The admin backend cannot be reached.");
  });

  it("checks the email shape, the name length and the password length", () => {
    assert.equal(emailAddress("name@example.com"), null);
    for (const bad of ["name", "a@b", "a b@x.test", `${"a".repeat(250)}@x.test`]) {
      assert.equal(emailAddress(bad), "Email must look like name@example.com.", bad);
    }
    assert.equal(nameLength("x".repeat(80)), null);
    assert.equal(nameLength("x".repeat(81)), "Name must be 1 to 80 characters.");
    assert.equal(passwordLength("x"), null);
    assert.equal(passwordLength("x".repeat(256)), null);
    assert.equal(passwordLength("x".repeat(257)), "Password must be at most 256 characters.");
    assert.equal(passwordLength(" ".repeat(12)), null, "whitespace is kept, never trimmed");
  });

  it("refuses the first bad value on Create, and on a save only the fields being changed", () => {
    assert.deepEqual(firstCreateRefusal({ name: "N", email: "bad", password: "x".repeat(12) }), {
      field: "email",
      sentence: "Email must look like name@example.com.",
    });
    assert.equal(firstCreateRefusal({ name: "N", email: "e@x.test", password: "x".repeat(12) }), null);
    assert.equal(firstSaveRefusal({}), null);
    assert.equal(firstSaveRefusal({ name: "" })?.field, "name");
  });
});

describe("the rows", () => {
  it("shows the state as a word, a dimmed disabled row, and the last sign-in or never", () => {
    const enabled = accountRow(account("a", false, { lastSignInAt: new Date(2026, 9, 17, 9, 5).getTime() }));
    assert.deepEqual([enabled.state.word, enabled.state.dimmed, enabled.when], ["enabled", false, "2026-10-17 09:05"]);
    const off = accountRow(account("b", true));
    assert.deepEqual([off.state.word, off.state.dimmed, off.when], ["disabled", true, "never"]);
  });

  it("builds the time from local parts, padded", () => {
    assert.equal(formatWhen(new Date(2026, 0, 2, 3, 4).getTime()), "2026-01-02 03:04");
    assert.equal(formatWhen(undefined), "never");
  });

  it("reads mixed over a part of the list and empty over none", () => {
    const items = [account("a"), account("b")];
    assert.equal(selectAllState([], []), false);
    assert.equal(selectAllState(items, ["a"]), "mixed");
    assert.equal(selectAllState(items, ["a", "b"]), true);
  });
});
