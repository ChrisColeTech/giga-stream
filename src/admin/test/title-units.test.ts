import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commaItems, commaText, minutesOf, numberOf, runtimeMsOf, textOf } from "@/lib/title-units";

describe("runtime", () => {
  it("is minutes in the form and runtimeMs on the wire", () => {
    assert.equal(runtimeMsOf("136"), 8_160_000);
    assert.equal(minutesOf(8_160_000), "136");
    assert.equal(runtimeMsOf(" "), undefined);
    assert.equal(minutesOf(undefined), "");
    assert.ok(Number.isNaN(runtimeMsOf("1.5") ?? 0));
  });
});

describe("comma lists", () => {
  it("trim, drop empties and keep a repeat once", () => {
    assert.deepEqual(commaItems(" Drama, Fantasy ,, Drama "), ["Drama", "Fantasy"]);
    assert.deepEqual(commaItems(""), []);
    assert.equal(commaText(["Ann", "Bo"]), "Ann, Bo");
    assert.equal(commaText(undefined), "");
  });
});

describe("numbers", () => {
  it("read an empty field as absent", () => {
    assert.deepEqual([numberOf(""), numberOf(" 8.5 "), textOf(undefined), textOf(1999)], [undefined, 8.5, "", "1999"]);
  });
});
