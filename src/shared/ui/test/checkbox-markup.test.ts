import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox } from "../src/controls/Checkbox";

const NOTHING = (): void => undefined;
const render = (checked: boolean | "mixed", extra: { disabled?: boolean } = {}): string =>
  renderToStaticMarkup(createElement(Checkbox, { checked, onChange: NOTHING, "aria-label": "Select Fixture News", ...extra }));

test("a tick is a 20px checkbox button named by its label", () => {
  const html = render(false);
  assert.ok(html.includes('role="checkbox"') && html.includes('aria-label="Select Fixture News"'));
  assert.ok(html.includes("size-5") && html.includes('type="button"'));
});

test("off has no check and no accent; on carries the accent state and a check", () => {
  const off = render(false);
  assert.ok(off.includes('aria-checked="false"') && !off.includes('data-on=""') &&!off.includes("<svg"));
  const on = render(true);
  assert.ok(on.includes('aria-checked="true"') && on.includes('data-on=""') && on.includes("<svg"));
  assert.ok(on.includes("data-on:border-accent") && on.includes("var(--color-accent-strong)"));
});

test("mixed is announced as mixed, lit, and drawn with a dash", () => {
  const html = render("mixed");
  assert.ok(html.includes('aria-checked="mixed"') && html.includes('data-on=""'));
  assert.ok(html.includes("lucide-minus"));
});

test("a disabled tick is natively disabled", () => {
  assert.ok(render(true, { disabled: true }).includes('disabled=""'));
  assert.ok(!render(true).includes('disabled=""'));
});

test("it is never a form field: no input, no aria-disabled", () => {
  const html = render(true);
  assert.ok(!html.includes("<input") && !html.includes("aria-disabled"));
});
