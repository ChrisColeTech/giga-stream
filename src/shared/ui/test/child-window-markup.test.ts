import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChildMemoryContext } from "../src/lib/child-memory";
import type { ChildMemory } from "../src/lib/child-memory";
import { workSpec } from "../src/lib/child-metrics";
import { ChildWindow } from "../src/windows/ChildWindow";

const spec = workSpec("settings", "Settings");

/* The window reads the viewport and listens for its resize; the server render has no DOM, so a stub stands in. */
before(() => {
  const none = (): void => undefined;
  Object.assign(globalThis, {
    window: { innerWidth: 1600, innerHeight: 1000, addEventListener: none, removeEventListener: none },
  });
});
after(() => {
  Reflect.deleteProperty(globalThis, "window");
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

const render = (memory?: ChildMemory, modal = true): string => {
  const props = { spec: { ...spec, modal }, onClose: () => undefined, children: createElement("p", null, "body") };
  const window = createElement(ChildWindow, props);
  return renderToStaticMarkup(memory === undefined ? window : createElement(ChildMemoryContext, { value: memory }, window));
};

test("the window is a labelled modal dialog with its close X, eight grips and a drag header", () => {
  const html = render();
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-label="Settings window"'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(html.includes('data-child-window="settings"'));
  assert.ok(html.includes('aria-label="Close Settings"'));
  assert.equal(count(html, "data-grip="), 8);
  assert.ok(html.includes("data-drag"));
  assert.ok(html.includes("<p>body</p>"));
});

test("a modal window draws the scrim over the main window and its titlebar slice; a tool window does not", () => {
  assert.ok(render().includes("data-scrim"));
  assert.ok(render().includes("data-scrim-titlebar"));
  assert.equal(render(undefined, false).includes("data-scrim"), false);
  assert.equal(render(undefined, false).includes("aria-modal"), false);
});

test("with no memory the window opens centred at its content's size", () => {
  const html = render();
  assert.ok(html.includes("width:978px"));
  assert.ok(html.includes("height:752px"));
  assert.ok(html.includes("left:311px"));
});

test("the window opens where the memory says it was, and asks for it by its key", () => {
  const asked: string[] = [];
  const memory: ChildMemory = {
    recall: (key) => {
      asked.push(key);
      return { x: 20, y: 60, width: 700, height: 500 };
    },
    remember: () => undefined,
  };
  const html = render(memory);
  assert.ok(html.includes("left:20px;top:60px;width:700px;height:500px"));
  assert.deepEqual(asked, ["settings"]);
});
