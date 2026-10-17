import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialAdminDraft, reconcileAdminDraft } from "@/lib/settings-admin-draft";

describe("the Admin address draft", () => {
  it("tracks a committed value until the person edits", () => {
    const initial = initialAdminDraft("first");
    assert.deepEqual(reconcileAdminDraft(initial, "restored", 0), initialAdminDraft("restored"));
    const editing = { ...initial, draft: "typing", edited: true };
    assert.equal(reconcileAdminDraft(editing, "restored", 0), editing);
  });

  it("shows a refused rollback and a normalized committed answer", () => {
    const submitted = {
      ...initialAdminDraft("old"),
      draft: "sent",
      sent: "sent",
      edited: true,
      submittedRevision: 4,
    };
    assert.deepEqual(reconcileAdminDraft(submitted, "old", 4), initialAdminDraft("old"));
    assert.deepEqual(reconcileAdminDraft(submitted, "normalized", 4), initialAdminDraft("normalized"));
  });

  it("preserves text typed after submission while adopting the settled comparison value", () => {
    const editing = {
      ...initialAdminDraft("old"),
      draft: "new typing",
      sent: "sent",
      edited: true,
      submittedRevision: 4,
      editedAfterSubmit: true,
    };
    assert.deepEqual(reconcileAdminDraft(editing, "normalized", 4), {
      ...editing,
      sent: "normalized",
      submittedRevision: null,
      editedAfterSubmit: false,
    });
  });
});
