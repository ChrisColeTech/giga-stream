import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAST_ACCOUNT } from "@/constants/record-copy";
import { createBody, passwordBody } from "@/lib/account-body";
import {
  createReason,
  firstCreateRefusal,
  firstSaveRefusal,
  passwordLength,
  usernameLength,
} from "@/lib/account-checks";
import { changedFields, draftOf, isEmptyPatch, sameAccountDraft } from "@/lib/account-draft";
import { deleteReason, disableReason, isLastEnabled } from "@/lib/account-guard";
import { accountRow, kindLabel, selectAllState } from "@/lib/account-rows";
import { formatWhen } from "@/lib/format-when";
import type { AdminAccount } from "@/types/admin-account";

const account = (id: string, disabled = false, extra: Partial<AdminAccount> = {}): AdminAccount => ({
  id,
  username:`${id}@x.test`,
  disabled,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const FREE = { unreachable: false, busy: false };
const NEW = (username: string, password: string, kind: "admin" | "user" = "admin") => ({ username, password, kind });

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
  const saved = account("a", false);

  it("makes Enabled the inverse of disabled, and is dirty by value", () => {
    assert.deepEqual(draftOf(saved), { username: "a@x.test", enabled: true });
    assert.deepEqual(draftOf(account("b", true)).enabled, false);
    assert.equal(sameAccountDraft(draftOf(saved), { ...draftOf(saved), enabled: false }), false);
  });

  it("sends only the changed fields, trimmed", () => {
    assert.ok(isEmptyPatch(changedFields(saved, draftOf(saved))));
    assert.deepEqual(changedFields(saved, { username: " b@x.test ", enabled: false }), { username: "b@x.test", disabled: true });
    assert.deepEqual(changedFields(account("d", true), { ...draftOf(account("d", true)), enabled: true }), { disabled: false });
  });

  it("builds the create body with the password untouched and the kind always on (`62` section 3.7)", () => {
    assert.deepEqual(createBody(NEW(" e@x.test ", " p ")), { username: "e@x.test", password: " p ", kind: "admin" });
    assert.deepEqual(createBody(NEW(" e@x.test ", " p ", "user")), {
      username: "e@x.test",
      password: " p ",
      kind: "user",
    });
    assert.deepEqual(passwordBody(" p "), { password: " p " });
  });
});

describe("the field checks", () => {
  it("names the first missing field, in the form's order: Username, Password", () => {
    assert.equal(createReason(NEW("", ""), false, false), "Username is required.");
    assert.equal(createReason(NEW(" ", ""), false, false), "Username is required.");
    assert.equal(createReason(NEW("e@x.test", ""), false, false), "Password is required.");
    const full = NEW("e@x.test", "x".repeat(12));
    assert.equal(createReason(full, false, false), undefined);
    assert.equal(createReason(full, true, false), "Saving.");
    assert.equal(createReason(full, false, true), "The admin backend cannot be reached.");
  });

  it("checks the username length (no format) and the password length", () => {
    for (const good of ["name@example.com", "name", "a b", "ünï cødé", "u".repeat(254), "  padded  "]) {
      assert.equal(usernameLength(good), null, good);
    }
    assert.equal(usernameLength("u".repeat(255)), "Username must be 1 to 254 characters.");
    assert.equal(usernameLength("   "), null, "emptiness is the required check's, not the length's");
    assert.equal(passwordLength("x"), null);
    assert.equal(passwordLength("x".repeat(256)), null);
    assert.equal(passwordLength("x".repeat(257)), "Password must be at most 256 characters.");
    assert.equal(passwordLength(" ".repeat(12)), null, "whitespace is kept, never trimmed");
  });

  it("refuses the first bad value on Create, and on a save only the fields being changed", () => {
    assert.deepEqual(firstCreateRefusal(NEW("u".repeat(255), "x".repeat(12))), {
      field: "username",
      sentence: "Username must be 1 to 254 characters.",
    });
    assert.equal(firstCreateRefusal(NEW("not an email", "x".repeat(12))), null);
    assert.equal(firstCreateRefusal(NEW("e@x.test", "x".repeat(12), "user")), null);
    assert.equal(firstSaveRefusal({}), null);
    assert.equal(firstSaveRefusal({ username: "" })?.field, "username");
  });
});

describe("the rows", () => {
  it("shows the state as a word, a dimmed disabled row, and the last sign-in or never", () => {
    const enabled = accountRow(account("a", false, { lastSignInAt: new Date(2026, 9, 17, 9, 5).getTime() }));
    assert.deepEqual([enabled.state.word, enabled.state.dimmed, enabled.when], ["enabled", false, "2026-10-17 09:05"]);
    const off = accountRow(account("b", true));
    assert.deepEqual([off.state.word, off.state.dimmed, off.when], ["disabled", true, "never"]);
  });

  it("reads the kind as Admin or User, and an answer without the field as Admin (`62` section 3.7)", () => {
    assert.deepEqual([accountRow(account("a")).kind, accountRow(account("b", false, { kind: "admin" })).kind], ["Admin", "Admin"]);
    assert.equal(accountRow(account("c", false, { kind: "user" })).kind, "User");
    assert.equal(kindLabel({}), "Admin", "absence is what the backend answered before the column existed");
    assert.deepEqual([kindLabel({ kind: "admin" }), kindLabel({ kind: "user" })], ["Admin", "User"]);
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
