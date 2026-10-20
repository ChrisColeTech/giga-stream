import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GateWall } from "@/components/gate/GateWall";
import { SignUpForm } from "@/components/gate/SignUpForm";
import { GATE_HEADING, GATE_BRAND_HEADLINE } from "@/constants/gate-copy";
import { useAppStore } from "@/store/app-store";

const draw = (element: ReactElement): string => renderToStaticMarkup(element);

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the full-screen gate wall (`34` sections 2 and 4)", () => {
  it("it is the admin console's template: a full-viewport wall with the brand headline and the gate's forms", () => {
    const markup = draw(createElement(GateWall, { onClose: () => undefined, onBack: () => undefined }));
    assert.ok(markup.includes("fixed inset-0") || markup.includes("h-full"), "the wall fills the viewport");
    assert.ok(markup.includes(GATE_BRAND_HEADLINE), "the brand panel carries its headline");
    assert.ok(markup.includes(GATE_HEADING));
    assert.ok(markup.includes("Username") && markup.includes("Password"));
    assert.ok(markup.includes("Forgot password?"), "the reset flow rides the same wall");
    assert.ok(markup.includes("Sign up"), "registration is offered from sign in");
    assert.ok(markup.includes("Back"), "the screen-corner way out stays visible");
    assert.ok(markup.includes('role="dialog"') && markup.includes('aria-modal="true"'), "the wall is the admin's modal template");
  });

  it("the sign-up form has all four fields, eight native choices and one primary Sign up", () => {
    const markup = draw(createElement(SignUpForm, { onBack: () => undefined }));
    assert.ok(markup.includes("Username") && markup.includes("Password"));
    assert.ok(markup.includes("Security question") && markup.includes("Security answer"));
    assert.equal((markup.match(/<option/g) ?? []).length, 9, "one prompt plus eight questions");
    assert.ok(markup.includes("Back to sign in"));
  });

  it("the shell behind it is inert while the wall is up, and the wall leaves with the store", () => {
    const { openGate, closeGate } = useAppStore.getState();
    openGate();
    assert.equal(useAppStore.getState().gateOpen, true);
    closeGate();
    assert.equal(useAppStore.getState().gateOpen, false);
  });

  it("Back is fixed to the screen corner and selects Live before closing", () => {
    const wall = readFileSync("src/components/gate/GateWall.tsx", "utf8");
    const app = readFileSync("src/components/chrome/App.tsx", "utf8");
    assert.match(wall, /absolute right-4 bottom-4/);
    assert.match(app, /setSurface\("live"\); closeGate\(\)/);
  });
});
