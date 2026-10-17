import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Eye, Info } from "lucide-react";

import { labelColumn } from "../src/lib/label-column";
import { SettingsFrame } from "../src/windows/SettingsFrame";
import { SettingsRail } from "../src/windows/SettingsRail";

type Id = "appearance" | "about";

const SECTIONS = [
  { id: "appearance" as const, label: "Appearance", icon: Eye },
  { id: "about" as const, label: "About", icon: Info },
];

const count = (html: string, needle: string) => html.split(needle).length - 1;

const rail = (selected: Id): string =>
  renderToStaticMarkup(createElement(SettingsRail<Id>, { sections: SECTIONS, selected, onSelect: () => undefined }));

const frame = (labels: readonly string[]): string =>
  renderToStaticMarkup(
    createElement(SettingsFrame<Id>, {
      sections: SECTIONS,
      selected: "about",
      onSelect: () => undefined,
      labels,
      children: createElement("p", null, "body"),
    }),
  );

test("the rail is a vertical tablist 150 wide, and 210 on a wide window", () => {
  const html = rail("appearance");
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('aria-orientation="vertical"'));
  assert.ok(html.includes("w-[150px]"));
  assert.ok(html.includes("lg:w-[210px]"));
});

test("the rail has one tab per section, in order, and only the selected one is selected", () => {
  const html = rail("about");
  assert.equal(count(html, 'role="tab"'), 2);
  assert.ok(html.indexOf(">Appearance<") < html.indexOf(">About<"));
  assert.equal(count(html, 'aria-selected="true"'), 1);
  assert.equal(count(html, 'aria-selected="false"'), 1);
  assert.equal(count(html, 'data-selected=""'), 1);
});

test("the frame is the rail beside a tabpanel named for the selected section", () => {
  const html = frame(["Theme"]);
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('role="tabpanel"'));
  assert.ok(html.includes('aria-label="About"'));
  assert.ok(html.includes("<p>body</p>"));
});

test("the label column is the one passed in: sized from the longest label, never under 120", () => {
  assert.ok(frame(["Theme"]).includes(`--label-col:${labelColumn(["Theme"])}`));
  assert.ok(frame(["Theme"]).includes("--label-col:120px"));
  const long = frame(["Reduce motion", "Mark as watched"]);
  assert.ok(long.includes(`--label-col:${labelColumn(["Mark as watched"])}`));
  assert.notEqual(labelColumn(["Mark as watched"]), "120px");
});
