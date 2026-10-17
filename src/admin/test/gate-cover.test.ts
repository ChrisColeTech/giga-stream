import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { AppShell } from "@/components/chrome/AppShell";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore } from "./support/store";

const shell = (): string => renderLive(createElement(AppShell));

beforeEach(() => {
  resetStore();
});

describe("the signed-out window", () => {
  beforeEach(() => {
    useAppStore.getState().signOut();
  });

  it("is the gate and nothing else: no titlebar, tab pill, toggles, Events drawer or statusbar", () => {
    const html = shell();
    assert.ok(html.includes('role="dialog"') && html.includes('aria-label="Sign in"'));
    assert.ok(!html.includes("<header"), "no titlebar");
    assert.ok(!html.includes("Sign in first"), "no tab pill");
    assert.ok(!html.includes('aria-label="Events'), "no Events drawer or toggle");
    assert.ok(!html.includes("<footer"), "no statusbar");
    assert.ok(!html.includes("Channels"), "no tab or page");
  });

  it("keeps the shell behind the wall inert and hidden from assistive tech", () => {
    const html = shell();
    assert.ok(/<div[^>]*\binert=""[^>]*aria-hidden="true"/.test(html), "inert and aria-hidden");
    assert.ok(html.indexOf("inert") < html.indexOf('role="dialog"'), "the shell comes first, the wall over it");
  });
});

describe("the signed-in window", () => {
  it("has the chrome, an active shell and no wall", () => {
    const html = shell();
    assert.ok(html.includes("<header"));
    assert.ok(!html.includes('role="dialog" aria-modal="true" aria-label="Sign in'));
    assert.ok(html.startsWith('<div class="h-full w-full"><div class="h-full w-full overflow-auto">'), "shell not inert");
  });
});
