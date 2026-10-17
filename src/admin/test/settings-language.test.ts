import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBTITLE_LANGUAGES, SUBTITLE_OFF } from "@/constants/settings-sections";
import { languageOption, languageTag } from "@/lib/settings-language";

describe("the subtitle language select", () => {
  it("shows the stored null as the off choice", () => {
    assert.equal(languageOption(null), SUBTITLE_OFF);
    assert.equal(languageOption("en"), "en");
  });

  it("stores the off choice as null and any other choice as its tag", () => {
    assert.equal(languageTag(SUBTITLE_OFF), null);
    assert.equal(languageTag("fr"), "fr");
  });

  it("round-trips every offered choice", () => {
    for (const option of SUBTITLE_LANGUAGES) {
      const stored = languageTag(option.value);
      assert.equal(languageOption(stored), option.value);
    }
  });

  it("offers the off choice first", () => {
    assert.equal(SUBTITLE_LANGUAGES[0]?.value, SUBTITLE_OFF);
    assert.equal(SUBTITLE_LANGUAGES[0]?.label, "Off");
  });
});
