import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendEvent, EVENT_LOG_LIMIT, restEvent, type EventRow } from "../src/lib/event-log";

const row = (index: number): EventRow => ({
  id: String(index),
  at: index,
  tone: "info",
  area: "Connection",
  sentence: `row ${index}`,
});

describe("the event log", () => {
  it("keeps the newest 200 rows in chronological order", () => {
    let rows: readonly EventRow[] = [];
    for (let index = 0; index <= EVENT_LOG_LIMIT; index += 1) rows = appendEvent(rows, row(index), index);
    assert.equal(rows.length, EVENT_LOG_LIMIT);
    assert.equal(rows[0]?.sentence, "row 1");
    assert.equal(rows.at(-1)?.sentence, `row ${EVENT_LOG_LIMIT}`);
  });

  it("names the host the program gives, with the method, the outcome and the rounded time", () => {
    const event = restEvent("backend", "get", 404, 12.6, "Catalog");
    assert.equal(event.tone, "warn");
    assert.equal(event.area, "Catalog");
    assert.equal(event.sentence, "GET backend 404 in 13 ms.");
    assert.doesNotMatch(event.sentence, /api|https?:|\?/);
  });

  it("warns on an invalid or unreachable answer, and not on an abandoned request", () => {
    assert.equal(restEvent("fileserver", "GET", "invalid", 1, "Connection").tone, "warn");
    assert.equal(restEvent("fileserver", "GET", "unreachable", 1, "Connection").tone, "warn");
    assert.equal(restEvent("fileserver", "GET", "aborted", 2, "Connection").tone, "info");
    assert.equal(restEvent("fileserver", "GET", 200, 2, "Connection").tone, "info");
  });
});
