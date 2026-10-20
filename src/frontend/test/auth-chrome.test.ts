import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("auth chrome composition (`65` wave 3)", () => {
  it("omits the Statusbar in a browser and retains it only for Electron", () => {
    const shell = readFileSync("src/components/chrome/AppShell.tsx", "utf8");
    assert.match(shell, /runtime === "electron" \? <Statusbar \/> : null/);
  });

  it("hosts both account surfaces in the one OverlayHost with shared primitives", () => {
    const host = readFileSync("src/components/overlays/OverlayHost.tsx", "utf8");
    assert.match(host, /overlay === "account-popup"/);
    assert.match(host, /overlay === "account"/);
    assert.match(readFileSync("src/components/chrome/AccountPopup.tsx", "utf8"), /PopupPanel/);
    assert.match(readFileSync("src/components/chrome/AccountWindow.tsx", "utf8"), /ChildWindow/);
  });

  it("keeps Escape in a focused wall hook and returns account-flow focus to its opener", () => {
    const wall = readFileSync("src/components/gate/GateWall.tsx", "utf8");
    const hook = readFileSync("src/hooks/useGateWallEscape.ts", "utf8");
    const control = readFileSync("src/components/chrome/AccountControl.tsx", "utf8");
    assert.ok(!wall.includes("addEventListener"));
    assert.match(hook, /defaultPrevented/);
    assert.match(hook, /isComposing/);
    assert.match(control, /opener\.current\?\.focus\(\)/);
    assert.match(readFileSync("src/components/chrome/AccountPopup.tsx", "utf8"), /<Button autoFocus/);
  });
});
