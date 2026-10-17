import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBlock, renameBlock } from "@/lib/collections-name";

describe("creating a collection", () => {
  it("a blank or spaces-only name has nothing to create", () => {
    assert.equal(createBlock(""), "blank");
    assert.equal(createBlock("   "), "blank");
  });

  it("a typed name can be created", () => {
    assert.equal(createBlock("Weekend picks"), undefined);
  });
});

describe("renaming a collection", () => {
  it("a blank name cannot be sent", () => {
    assert.equal(renameBlock("  ", "Kids"), "blank");
  });

  it("the same name, ignoring surrounding spaces, changes nothing", () => {
    assert.equal(renameBlock("Kids", "Kids"), "unchanged");
    assert.equal(renameBlock("  Kids  ", "Kids"), "unchanged");
  });

  it("a different name can be sent", () => {
    assert.equal(renameBlock("Family", "Kids"), undefined);
  });
});
