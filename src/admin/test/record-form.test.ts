import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearRefusals,
  discardForm,
  isDirty,
  refuseField,
  resetForm,
  setFields,
  startForm,
} from "@/lib/record-form";

interface Draft {
  readonly name: string;
  readonly username: string;
}
const same = (a: Draft, b: Draft): boolean => a.name === b.name && a.username === b.username;
const start = () => startForm<Draft>({ name: "Ada", username: "ada@x.test" });

describe("the record form core", () => {
  it("is dirty by value: typing a value back is clean again", () => {
    let form = start();
    assert.equal(isDirty(form, same), false);
    form = setFields(form, { name: "Eve" });
    assert.equal(isDirty(form, same), true);
    form = setFields(form, { name: "Ada" });
    assert.equal(isDirty(form, same), false);
  });

  it("rebases on reset: the saved record is the new baseline", () => {
    const form = resetForm(setFields(start(), { name: "Eve" }), { name: "Eve", username: "ada@x.test" });
    assert.equal(isDirty(form, same), false);
    assert.equal(discardForm(setFields(form, { name: "Zed" })).draft.name, "Eve");
  });

  it("discards back to the baseline and clears the refusals", () => {
    const form = discardForm(refuseField(setFields(start(), { username: "bad" }), "username", "Nope."));
    assert.deepEqual([form.draft, form.errors], [start().draft, {}]);
  });

  it("sets a refusal under a row, clears it when that field is typed, and clears all", () => {
    let form = refuseField(refuseField(start(), "username", "E."), "name", "N.");
    assert.deepEqual(form.errors, { username: "E.", name: "N." });
    form = setFields(form, { username: "x@y.test" });
    assert.deepEqual(form.errors, { name: "N." });
    assert.deepEqual(clearRefusals(form).errors, {});
  });
});
