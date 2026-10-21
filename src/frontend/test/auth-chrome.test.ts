import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("auth chrome composition (`65` wave 3)", () => {
  it("omits the Statusbar in a browser and retains it only for Electron", () => {
    const shell = readFileSync("src/components/chrome/AppShell.tsx", "utf8");
    assert.match(shell, /const desktop = useDesktopRenderer\(\)/);
    assert.match(shell, /statusbar=\{desktop \? <Statusbar \/> : null\}/);
  });

  it("hosts only the Account work window as an overlay and uses the shell's shared menu host", () => {
    const host = readFileSync("src/components/overlays/OverlayHost.tsx", "utf8");
    assert.match(host, /overlay === "account"/);
    assert.doesNotMatch(host, /account-popup|AccountPopup|PopupPanel/);
    assert.match(readFileSync("src/components/chrome/AppShell.tsx", "utf8"), /<ContextMenu\b/);
    assert.match(readFileSync("src/hooks/useAccountMenu.ts", "utf8"), /openMenu\(/);
    assert.match(readFileSync("src/components/chrome/AccountWindow.tsx", "utf8"), /ChildWindow/);
  });

  it("keeps Escape in a focused wall hook and returns account-flow focus to its opener", () => {
    const wall = readFileSync("src/components/gate/GateWall.tsx", "utf8");
    const hook = readFileSync("src/hooks/useGateWallEscape.ts", "utf8");
    const control = readFileSync("src/components/chrome/AccountControl.tsx", "utf8");
    const menu = readFileSync("src/hooks/useAccountMenu.ts", "utf8");
    assert.ok(!wall.includes("addEventListener"));
    assert.match(hook, /defaultPrevented/);
    assert.match(hook, /isComposing/);
    assert.match(menu, /opener\.current\?\.focus\(\)/);
    assert.doesNotMatch(control, /addEventListener|setTimeout|PopupPanel|getBoundingClientRect/);
  });
});
