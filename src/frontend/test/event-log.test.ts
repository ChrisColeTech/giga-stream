import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendEvent, EVENT_LOG_LIMIT, restEvent } from "@/lib/event-log";
import type { EventRow } from "@/types/events";

const row = (index: number): EventRow => ({
  id: String(index),
  at: index,
  tone: "info",
  area: "Connection",
  sentence: `row ${index}`,
});

describe("event log", () => {
  it("keeps the newest 200 rows in chronological order", () => {
    let rows: readonly EventRow[] = [];
    for (let index = 0; index <= EVENT_LOG_LIMIT; index += 1) rows = appendEvent(rows, row(index), index);
    assert.equal(rows.length, EVENT_LOG_LIMIT);
    assert.equal(rows[0]?.sentence, "row 1");
    assert.equal(rows.at(-1)?.sentence, `row ${EVENT_LOG_LIMIT}`);
  });

  it("formats REST events with the fixed host and no request address", () => {
    const event = restEvent("get", 404, 12.6, "Catalog");
    assert.equal(event.tone, "warn");
    assert.equal(event.sentence, "GET fileserver 404 in 13 ms.");
    assert.doesNotMatch(event.sentence, /api|https?:|\?/);
  });

  it("does not treat an abandoned request as a failure", () => {
    assert.equal(restEvent("GET", "aborted", 2, "Catalog").tone, "info");
  });
});
