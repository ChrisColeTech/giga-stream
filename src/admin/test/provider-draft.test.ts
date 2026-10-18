import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discardForm, isDirty, resetForm, setFields, startForm } from "@/lib/record-form";
import { draftOfProvider, sameProviderDraft, showsTemplates } from "@/lib/provider-draft";
import { createdAt, providerRow, sortedProviders } from "@/lib/provider-rows";
import type { AdminProvider } from "@/services/schemas/provider-schema";

const provider = (id: number, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id,
  name: `P${id}`,
  source: `p${id}`,
  is_active: true,
  order: 1,
  family: "embed",
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});

describe("the provider draft", () => {
  it("reads absent fields as empty and is_active as Enabled", () => {
    const draft = draftOfProvider(provider(1, { is_active: false }));
    assert.deepEqual([draft.enabled, draft.origin, draft.frameOrigins, draft.messageShape], [false, "", [], ""]);
  });

  it("is dirty by value: typing a value back is clean, discard returns to the baseline", () => {
    const start = startForm(draftOfProvider(provider(1)));
    const typed = setFields(start, { frameOrigins: ["https://a.test"] });
    assert.ok(isDirty(typed, sameProviderDraft));
    assert.ok(!isDirty(setFields(typed, { frameOrigins: [] }), sameProviderDraft));
    assert.ok(!isDirty(discardForm(typed), sameProviderDraft));
    const saved = resetForm(typed, draftOfProvider(provider(1, { order: 3 })));
    assert.equal(saved.baseline.order, 3);
  });

  it("switches the template rows by family", () => {
    assert.deepEqual([showsTemplates("embed"), showsTemplates("stream")], [true, false]);
  });
});

describe("the provider rows", () => {
  it("sort by order, then name", () => {
    const sorted = sortedProviders([provider(1, { order: 2, name: "b" }), provider(2, { order: 1, name: "z" }), provider(3, { order: 2, name: "A" })]);
    assert.deepEqual(sorted.map((item) => item.id), [2, 3, 1]);
  });

  it("show the family as a word and a disabled provider as `disabled`, dimmed", () => {
    const row = providerRow(provider(1, { is_active: false, family: "stream" }));
    assert.deepEqual([row.family, row.state.word, row.state.dimmed], ["Stream", "disabled", true]);
    assert.equal(createdAt("nonsense"), undefined);
  });
});
