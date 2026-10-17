import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addressToSend } from "@/lib/settings-address";

describe("the admin backend address commit", () => {
  it("sends a new draft, trimmed", () => {
    assert.equal(addressToSend("  https://admin.example.test  ", ""), "https://admin.example.test");
  });

  it("sends nothing when the draft equals the last value sent", () => {
    assert.equal(addressToSend("https://admin.example.test", "https://admin.example.test"), null);
    assert.equal(addressToSend("", ""), null);
  });

  it("sends nothing for a blur after an Enter that already sent the same value", () => {
    const afterEnter = addressToSend("https://a.example.test", "");
    assert.equal(afterEnter, "https://a.example.test");
    assert.equal(addressToSend("https://a.example.test", afterEnter ?? ""), null);
  });

  it("sends an edited value again after a refusal", () => {
    const refused = addressToSend("https://a.example.test", "");
    assert.equal(refused, "https://a.example.test");
    assert.equal(addressToSend("https://b.example.test", refused ?? ""), "https://b.example.test");
  });
});
