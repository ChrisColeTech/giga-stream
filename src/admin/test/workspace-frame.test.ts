import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore } from "./support/store";

const frame = (active: boolean) =>
  createElement(WorkspaceFrame, {
    tab: "channels",
    active,
    rail: createElement("nav", null, "RAIL"),
    toolbar: createElement("div", { role: "toolbar" }, "TOOLBAR"),
    children: createElement("main", null, "PAGE"),
  });

beforeEach(() => {
  resetStore();
});

describe("a workspace", () => {
  it("places the rail in the engine's left pane and, in its centre, the page toolbar first, then the page", () => {
    const html = renderLive(frame(true));
    assert.ok(html.indexOf('aria-label="Left pane"') < html.indexOf("RAIL"));
    assert.ok(html.indexOf("RAIL") < html.indexOf('aria-label="Centre"'));
    assert.ok(html.indexOf('aria-label="Centre"') < html.indexOf("TOOLBAR"));
    assert.ok(html.indexOf("TOOLBAR") < html.indexOf("PAGE"), "the toolbar sits above the scrolling page");
  });

  it("has no right or bottom pane", () => {
    const html = renderLive(frame(true));
    assert.ok(!html.includes('aria-label="Right pane"') && !html.includes('aria-label="Bottom pane"'));
  });

  it("stays mounted and hidden when its tab is not the one shown", () => {
    const shown = renderLive(frame(true));
    const hidden = renderLive(frame(false));
    assert.ok(hidden.includes("RAIL") && hidden.includes("PAGE"));
    assert.ok(hidden.includes('class="workspace hidden"') && !shown.includes("hidden"));
  });

  it("makes a closed rail inert, so its controls leave the tab order", () => {
    assert.ok(!renderLive(frame(true)).includes("inert"));
    useAppStore.getState().togglePane("left");
    assert.ok(renderLive(frame(true)).includes("inert"));
  });
});
