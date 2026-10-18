import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChipGroup } from "../src/controls/ChipGroup";
import { lockedByMin, minReason } from "../src/controls/chip-rules";

const OPTIONS = [
  { value: "360p", label: "360p" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

function render(selected: string[], extra: { min?: number; field?: boolean; disabled?: boolean; minText?: string } = {}) {
  return renderToStaticMarkup(
    createElement(ChipGroup, {
      options: OPTIONS,
      selected: new Set(selected),
      onToggle: () => undefined,
      "aria-label": "Qualities",
      ...extra,
    }),
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

test("the chips are Segmented's pills with no recessed track", () => {
  const html = render(["720p"]);
  assert.equal(count(html, "rounded-full"), 3);
  assert.ok(!html.includes("bg-surface p-0.5") && !html.includes("rounded-[1px]"));
  assert.ok(html.includes("inline-flex flex-none flex-wrap items-center gap-1.5"));
  assert.ok(html.includes("h-7 px-3 text-xs") && html.includes('aria-label="Qualities"'));
});

test("each chip is its own pressed toggle: any of them can be lit", () => {
  const html = render(["360p", "1080p"]);
  assert.equal(count(html, 'aria-pressed="true"'), 2);
  assert.equal(count(html, 'aria-pressed="false"'), 1);
  assert.equal(count(html, 'data-active=""'), 2);
});

test("the field size is 36px chips, equal, spanning the row", () => {
  const html = render(["720p"], { field: true });
  assert.equal(count(html, "h-9 px-3 text-sm"), 3);
  assert.ok(html.includes("grid w-full min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5"));
});

test("with no min nothing is locked", () => {
  assert.ok(!render(["720p"]).includes('disabled=""'));
});

test("the last min lit chips are natively disabled with the rule as their title", () => {
  const html = render(["720p", "1080p"], { min: 2 });
  assert.equal(count(html, 'disabled=""'), 2);
  assert.equal(count(html, `title="${minReason(2)}"`), 2);
  assert.ok(!html.includes("aria-disabled"));
});

test("above min every chip can still be switched off; an off chip is never locked", () => {
  const html = render(["360p", "720p", "1080p"], { min: 2 });
  assert.ok(!html.includes('disabled=""'));
  const off = render(["720p", "1080p"], { min: 2 });
  assert.ok(!(off.match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0] ?? "").includes('disabled=""'));
});

test("a caller words the reason", () => {
  assert.ok(render(["720p"], { min: 1, minText: "Pick at least one." }).includes('title="Pick at least one."'));
});

test("the whole group disabled disables every chip", () => {
  assert.equal(count(render(["720p"], { disabled: true }), 'disabled=""'), 3);
});

test("the rule: a chip is locked only while on and the count is at or under min", () => {
  assert.equal(lockedByMin(true, 2, 2), true);
  assert.equal(lockedByMin(true, 3, 2), false);
  assert.equal(lockedByMin(false, 1, 2), false);
  assert.equal(lockedByMin(true, 1, 0), false);
});
