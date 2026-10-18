import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChipsInput } from "../src/controls/ChipsInput";

function render(extra: { className?: string } = {}) {
  return renderToStaticMarkup(
    createElement(ChipsInput, {
      value: ["https://cdn.example.test"],
      onChange: () => undefined,
      ariaLabel: "Frame origins",
      ...extra,
    }),
  );
}

test("the className reaches the chips box, beside the track's own classes", () => {
  const html = render({ className: "min-h-9 w-full" });
  const track = html.match(/<div class="([^"]*rounded-ctl[^"]*)"/)?.[1] ?? "";
  assert.ok(track.includes("min-h-ctl-md") && track.includes("min-h-9 w-full"), track);
});

test("without a className the chips box is unchanged and the chips and input are drawn", () => {
  const html = render();
  assert.ok(!html.includes("min-h-9"));
  assert.ok(html.includes('aria-label="Remove https://cdn.example.test"'));
  assert.ok(html.includes('aria-label="Frame origins"'));
});
