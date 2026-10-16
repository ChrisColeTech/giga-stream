import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstShown } from "@/hooks/useShellKeyboard";

interface Field {
  readonly id: string;
  readonly shown: boolean;
}

describe("the active surface's search (Ctrl+F, 06 section 8)", () => {
  it("answers with the first field that is on screen, skipping the hidden surfaces", () => {
    const fields: Field[] = [
      { id: "live", shown: false },
      { id: "library", shown: true },
      { id: "player", shown: true },
    ];
    assert.equal(firstShown(fields, (field) => field.shown)?.id, "library");
  });

  it("answers with nothing when no field is on screen, so Ctrl+F does nothing", () => {
    const fields: Field[] = [{ id: "live", shown: false }];
    const none: Field[] = [];
    assert.equal(firstShown(fields, (field) => field.shown), undefined);
    assert.equal(firstShown(none, (field) => field.shown), undefined);
  });
});
