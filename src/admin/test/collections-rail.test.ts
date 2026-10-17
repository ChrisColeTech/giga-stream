import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alphabetical } from "@/lib/collections-order";

describe("the rail's order", () => {
  it("lists collections alphabetically by name", () => {
    const rows = [{ name: "Kids" }, { name: "Local films" }, { name: "Weekend picks" }, { name: "Action" }];
    assert.deepEqual(
      alphabetical(rows).map((row) => row.name),
      ["Action", "Kids", "Local films", "Weekend picks"],
    );
  });

  it("does not change the list it was given", () => {
    const rows = [{ name: "b" }, { name: "a" }];
    alphabetical(rows);
    assert.deepEqual(rows.map((row) => row.name), ["b", "a"]);
  });

  it("an empty list stays empty", () => {
    assert.deepEqual(alphabetical([]), []);
  });
});
