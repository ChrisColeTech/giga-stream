import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { maximizedBox, roomOf } from "../src/lib/child-bounds";
import { ChildMemoryContext, toggleMaximized } from "../src/lib/child-memory";
import type { ChildMemory } from "../src/lib/child-memory";
import { STATUSBAR_HEIGHT, TITLEBAR_HEIGHT, workSpec } from "../src/lib/child-metrics";
import type { Box } from "../src/lib/child-types";
import { ChildWindow } from "../src/windows/ChildWindow";

/* `36` sections 8.3 (the status bar) and 8.4 (maximize): the template's own behaviour, for every window. */

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

function render(over: { maximizable?: boolean; memory?: ChildMemory; status?: { left?: string; right?: string } } = {}): string {
  const spec = { ...workSpec("settings", "Settings"), ...(over.maximizable === undefined ? {} : { maximizable: over.maximizable }) };
  const children = createElement("p", null, "body");
  const window = createElement(ChildWindow, {
    spec,
    onClose: () => undefined,
    children,
    ...(over.status === undefined ? {} : { status: over.status }),
  });
  return renderToStaticMarkup(over.memory === undefined ? window : createElement(ChildMemoryContext, { value: over.memory }, window));
}

const kept = (maximized: boolean): ChildMemory => ({ recall: () => undefined, remember: () => undefined, maximized: () => maximized });

test("the maximized box is the main window minus its titlebar and statusbar, and follows a resize", () => {
  assert.deepEqual(maximizedBox({ width: 1600, height: 1000 }), { x: 0, y: TITLEBAR_HEIGHT, width: 1600, height: 1000 - TITLEBAR_HEIGHT - STATUSBAR_HEIGHT });
  assert.deepEqual(maximizedBox({ width: 900, height: 700 }), { x: 0, y: 40, width: 900, height: 636 });
  assert.equal(maximizedBox({ width: 900, height: 10 }).height, 0, "never negative");
  assert.equal(roomOf({ width: 900, height: 700 }).y, maximizedBox({ width: 900, height: 700 }).y);
});

test("maximizing hands the NORMAL box to memory first and sets the flag; restoring writes no bounds and clears it", () => {
  const events: string[] = [];
  const memory: ChildMemory = {
    recall: () => undefined,
    remember: (key, box) => events.push(`remember ${key} ${box.width}x${box.height}@${box.x},${box.y}`),
    setMaximized: (key, on) => events.push(`flag ${key} ${on}`),
  };
  const normal: Box = { x: 100, y: 120, width: 640, height: 480 };
  assert.equal(toggleMaximized(memory, "preview", normal, false), true);
  assert.equal(toggleMaximized(memory, "preview", normal, true), false);
  assert.deepEqual(events, ["remember preview 640x480@100,120", "flag preview true", "flag preview false"]);
  assert.equal(toggleMaximized({ recall: () => undefined, remember: () => undefined }, "k", normal, false), true, "a host without the flag still toggles");
});

test("every window gains the Maximize button by default, beside the close X, and nothing else", () => {
  const html = render();
  assert.equal(count(html, 'aria-label="Maximize Settings"'), 1);
  assert.ok(html.indexOf('aria-label="Maximize Settings"') < html.indexOf('aria-label="Close Settings"'), "left of the close X");
  assert.equal(count(html, "data-grip="), 8);
  assert.equal(count(html, "data-child-status"), 0, "no status strip without `status`");
  assert.ok(html.includes("width:978px") && html.includes("height:752px"), "the normal box is untouched");
});

test("a spec may opt out: no button and no double-click toggle target", () => {
  const html = render({ maximizable: false });
  assert.equal(count(html, "Maximize"), 0);
  assert.equal(count(html, "Restore"), 0);
});

test("a window that was maximized opens maximized: the container's area, no grips, a Restore button", () => {
  const html = render({ memory: kept(true) });
  assert.ok(html.includes("left:0;") && html.includes("top:40px") && html.includes("width:1600px") && html.includes("height:936px"));
  assert.equal(count(html, "data-grip="), 0);
  assert.equal(count(html, 'aria-label="Restore Settings"'), 1);
  assert.equal(count(html, "Maximize Settings"), 0);
  assert.ok(render({ memory: kept(false) }).includes("width:978px"), "a window never maximized opens normal");
});

test("an opted-out window ignores a remembered flag", () => {
  const html = render({ maximizable: false, memory: kept(true) });
  assert.ok(html.includes("width:978px") && count(html, "data-grip=") === 8);
});

test("a status bar is the last row after the body: h-6, hairline above, left and right items", () => {
  const html = render({ status: { left: "live", right: "2 / 5" } });
  const strip = html.indexOf("data-child-status");
  assert.ok(strip > html.indexOf("<p>body</p>"), "after the body");
  const tail = html.slice(strip);
  assert.ok(tail.includes("h-6") && tail.includes("border-t border-hair") && tail.includes("text-xs text-muted") && tail.includes("gap-2.5"));
  assert.ok(tail.indexOf(">live<") < tail.indexOf(">2 / 5<"), "left, then right");
});
