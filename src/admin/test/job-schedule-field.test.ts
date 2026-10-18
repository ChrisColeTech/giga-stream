import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstSaveRefusal, pagesRefusal, scheduleRefusal } from "@/lib/job-checks";
import { draftOf } from "@/lib/job-draft";
import type { AdminJob } from "@/services/schemas/job-schema";

const catalog: AdminJob = {
  id: 1,
  name: "Trending",
  type: "catalog",
  enabled: true,
  schedule: "6h",
  config: { scope: "trending", kind: "movie", pages: 5 },
  running: false,
  createdAt: 1,
};

describe("the Interval field", () => {
  it("accepts 6h, 30m, 24h and off", () => {
    for (const value of ["6h", "30m", "24h", "off", " OFF "]) assert.equal(scheduleRefusal(value), null, value);
  });

  it("refuses x, 0h and an empty value with a sentence for the row", () => {
    assert.equal(scheduleRefusal("x"), "Interval is a number and s, m or h, like 30m or 6h, or off.");
    assert.ok(scheduleRefusal("0h") !== null);
    assert.equal(scheduleRefusal(""), "Interval is required.");
  });

  it("is the save's refusal under `schedule`, after the name and a catalog job's pages", () => {
    assert.deepEqual(firstSaveRefusal({ ...draftOf(catalog), schedule: "x" }, true), {
      field: "schedule",
      sentence: "Interval is a number and s, m or h, like 30m or 6h, or off.",
    });
    assert.equal(firstSaveRefusal({ ...draftOf(catalog), name: " " }, true)?.field, "name");
    assert.equal(firstSaveRefusal({ ...draftOf(catalog), pages: "501", schedule: "x" }, true)?.field, "pages");
    assert.equal(firstSaveRefusal({ ...draftOf(catalog), pages: "501" }, false), null, "pages is a catalog field");
  });

  it("checks Pages from 1 to 500 (the Library fill walks 500, TMDB's cap)", () => {
    assert.equal(pagesRefusal("1"), null);
    assert.equal(pagesRefusal("500"), null);
    assert.equal(pagesRefusal("501"), "Pages must be a whole number from 1 to 500.");
    assert.equal(pagesRefusal("0"), "Pages must be a whole number from 1 to 500.");
  });
});
