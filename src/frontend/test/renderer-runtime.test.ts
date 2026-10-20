import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDesktopRenderer } from "@/hooks/useDesktopRenderer";
import { useAppStore } from "@/store/app-store";

function StatusbarProbe() {
  return createElement("div", null, useDesktopRenderer()
    ? createElement("span", { "data-statusbar": true }, "Statusbar")
    : null);
}

const draw = (): string => renderToStaticMarkup(createElement(StatusbarProbe));

describe("renderer chrome runtime", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it("omits the statusbar in a browser even when hydration describes an Electron host", () => {
    (globalThis as { window?: unknown }).window = {};
    useAppStore.setState({ runtime: "electron" });
    assert.doesNotMatch(draw(), /data-statusbar/);
  });

  it("includes the statusbar when the renderer has the Electron preload capability", () => {
    (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" } };
    useAppStore.setState({ runtime: "browser" });
    assert.match(draw(), /data-statusbar="true"/);
  });
});
