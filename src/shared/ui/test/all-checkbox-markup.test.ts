import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AllCheckbox, CLEAR_ALL_TIP, SELECT_ALL_TIP } from "../src/controls/AllCheckbox";

const render = (checked: boolean | "mixed", disabled = false): string =>
  renderToStaticMarkup(
    createElement(AllCheckbox, { checked, onChange: () => undefined, "aria-label": "Select all channels", disabled }),
  );

test("All is one checkbox button: the row tick's box and the word, named for its list", () => {
  const html = render(false);
  assert.equal(html.split("<button").length - 1, 1);
  assert.ok(html.includes('role="checkbox"') && html.includes('aria-label="Select all channels"') && html.includes(">All</button>"));
  assert.ok(html.includes("size-5") && html.includes("border-ctl-edge"));
});

test("it is three-state: none, some (a dash, lit) and all (a check, lit)", () => {
  assert.ok(render(false).includes('aria-checked="false"') && !render(false).includes("<svg"));
  const some = render("mixed");
  assert.ok(some.includes('aria-checked="mixed"') && some.includes("lucide-minus") && some.includes('data-on=""'));
  const all = render(true);
  assert.ok(all.includes('aria-checked="true"') && all.includes("lucide-check"));
});

test("its tooltip says what a press does: select every listed row, or clear once all are ticked", () => {
  assert.ok(render(false).includes(`title="${SELECT_ALL_TIP}"`) && render("mixed").includes(`title="${SELECT_ALL_TIP}"`));
  assert.ok(render(true).includes(`title="${CLEAR_ALL_TIP}"`));
});

test("with nothing listed it is natively disabled", () => {
  assert.ok(render(false, true).includes('disabled=""') && !render(false).includes('disabled=""'));
});
