import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventsDrawer, type EventsDrawerProps } from "../src/shell/EventsDrawer";
import type { EventRow } from "../src/lib/event-log";
import { SHIMMER } from "../src/lib/shimmer";

const row = (index: number): EventRow => ({
  id: `r-${index}`,
  at: 1_700_000_000_000 + index,
  tone: "info",
  area: "Connection",
  sentence: `GET fileserver 200 in ${index} ms.`,
});

function drawer(props: Partial<EventsDrawerProps> = {}): string {
  return renderToStaticMarkup(
    createElement(EventsDrawer, { open: true, rows: [], onClear: () => undefined, ...props }),
  );
}

describe("the events drawer's head and body", () => {
  it("states the count as N events, singular for one", () => {
    assert.match(drawer({ rows: [row(1), row(2), row(3)] }), />3 events</);
    assert.match(drawer({ rows: [row(1)] }), />1 event</);
    assert.match(drawer({ rows: [] }), />0 events</);
  });

  it("disables Clear with its reason while the log is empty, and enables it once there are rows", () => {
    const empty = drawer();
    assert.match(empty, /disabled=""[^>]*title="The log is empty\."/);
    const full = drawer({ rows: [row(1)] });
    assert.doesNotMatch(full, /disabled=""/);
    assert.match(full, /title="Clear the log"/);
  });

  it("draws five shimmer lines while empty and the rows once there are some", () => {
    assert.equal(drawer().split(SHIMMER).length - 1, 5);
    const full = drawer({ rows: [row(1), row(2)] });
    assert.equal(full.split(SHIMMER).length - 1, 0);
    assert.match(full, /GET fileserver 200 in 2 ms\./);
  });

  it("keeps the log as a live region named Events", () => {
    assert.match(drawer(), /role="log"[^>]*aria-label="Events"|aria-label="Events"[^>]*role="log"/);
  });
});

describe("the events drawer's Load older row", () => {
  it("is absent for a log that does not page", () => {
    assert.doesNotMatch(drawer({ rows: [row(1)] }), /Load older/);
  });

  it("is enabled when an older page exists", () => {
    const html = drawer({ rows: [row(1)], older: { available: true, onLoad: () => undefined } });
    assert.match(html, />Load older</);
    assert.doesNotMatch(html, /disabled=""[^>]*Load older|title="No older events\."/);
  });

  it("is disabled, with its reason, when there is nothing older", () => {
    const html = drawer({ rows: [row(1)], older: { available: false, onLoad: () => undefined } });
    assert.match(html, /disabled=""[^>]*title="No older events\."|title="No older events\."[^>]*disabled=""/);
  });
});
