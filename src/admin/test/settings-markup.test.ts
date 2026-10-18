import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createElement, type FunctionComponent } from "react";
import { SettingsWindow } from "@/components/overlays/SettingsWindow";
import { AboutSection } from "@/components/settings/AboutSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { SessionSection } from "@/components/settings/SessionSection";
import { SignInForm } from "@/components/session/SignInForm";
import { RESTORE_AT_DEFAULTS, SETTINGS_LABELS, ZOOM_AT_MIN } from "@/constants/settings-sections";
import { SIGN_IN_REASON } from "@/constants/sign-in-copy";
import { SignInPage } from "@/pages/SignInPage";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const render = (component: FunctionComponent): string => renderLive(createElement(component));

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("Appearance", () => {
  it("shows Theme, Reduce motion, Accent and UI zoom, and `Restore defaults` disabled with its reason at the defaults", () => {
    const html = render(AppearanceSection);
    for (const label of ["Theme", "Reduce motion", "Accent", "UI zoom"]) assert.ok(html.includes(`>${label}</span>`), label);
    assert.ok(html.includes(`aria-label="Restore defaults. ${RESTORE_AT_DEFAULTS}"`));
    assert.equal(html.split('aria-pressed="true"').length - 1, 2, "one theme and one motion pill are lit");
    assert.ok(html.includes("1.0"));
  });

  it("enables `Restore defaults` once anything differs, and shows the new choice at once", () => {
    state().setTheme("light");
    const html = render(AppearanceSection);
    assert.ok(!html.includes("Restore defaults. "));
    assert.ok(html.includes("Restore defaults"));
  });

  it("stops the zoom steps at the ends with their reasons", () => {
    state().setZoom(0.5);
    const html = render(AppearanceSection);
    assert.ok(html.includes(`aria-label="Zoom out. ${ZOOM_AT_MIN}"`));
    assert.ok(!html.includes('aria-label="Zoom in. '));
    assert.ok(html.includes("0.5"));
  });

  it("offers the five accents as swatches", () => {
    assert.equal(render(AppearanceSection).split('role="radio"').length - 1, 5);
  });
});

describe("Session", () => {
  it("names who is signed in, and Sign out works", () => {
    const html = render(SessionSection);
    assert.ok(html.includes("ada@example.test") && html.includes(">Ada<"));
    assert.ok(html.includes("Sign out") && !html.includes("Sign out. "));
  });

  it("is dashes with `Sign out` disabled and saying why while nobody is signed in", () => {
    state().signOut();
    const html = render(SessionSection);
    assert.ok(!html.includes("ada@example.test"));
    assert.ok(html.includes("—"));
    assert.ok(html.includes('aria-label="Sign out. You are not signed in."'));
  });
});

describe("About", () => {
  it("lists Version, Backend version, Backend revision, Address, Runtime and TMDB, the backend's facts as dashes", () => {
    const html = render(AboutSection);
    const order = ["Version", "Backend version", "Backend revision", "Address", "Runtime", "TMDB"].map((label) =>
      html.indexOf(`>${label}</span>`),
    );
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.ok(order.every((place) => place > 0));
    assert.ok(html.includes("0.1.0") && html.includes("Browser") && !html.includes("configured"));
  });
});

describe("the Settings window", () => {
  /* The window reads the viewport and listens for its resize; the server render has no DOM, so a stub stands in. */
  before(() => {
    const none = (): void => undefined;
    Reflect.set(globalThis, "window", { innerWidth: 1600, innerHeight: 1000, addEventListener: none, removeEventListener: none });
  });
  after(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("is the template's modal window with the three rail items, opening on Appearance", () => {
    const html = render(SettingsWindow);
    assert.ok(html.includes('aria-label="Settings window"') && html.includes('aria-modal="true"'));
    assert.ok(html.includes('aria-label="Close Settings"'));
    for (const label of ["Appearance", "Session", "About"]) assert.ok(html.includes(`>${label}</`), label);
    assert.ok(html.includes('role="tabpanel"') && html.includes('aria-label="Appearance"'));
    assert.ok(html.includes("--label-col"), "one label column for every page");
  });

  it("sizes its label column from every page's labels", () => {
    const longest = Math.max(...SETTINGS_LABELS.map((label) => label.length));
    assert.ok(render(SettingsWindow).includes(`--label-col:${Math.ceil(longest * 8) + 36}px`));
  });
});

describe("the sign-in page", () => {
  it("is the full-window wall: the brand column and one Sign in form of Username and Password, no placeholder", () => {
    const html = render(SignInPage);
    assert.ok(html.includes('aria-label="Sign in"') && html.includes('aria-modal="true"'));
    assert.ok(html.includes("GIGA") && html.includes("Run the channels."));
    assert.ok(html.indexOf('aria-label="Username"') < html.indexOf('aria-label="Password"'));
    assert.ok(!html.includes('type="email"') && html.includes('type="password"'));
    assert.ok(!/\splaceholder=/.test(html), "no placeholder attribute");
    assert.ok(!html.includes("aria-expanded"), "no fold");
    assert.ok(html.includes("--label-col"));
  });

  it("disables `Sign in` with its reason until both fields are filled", () => {
    const html = render(SignInForm);
    assert.ok(html.includes(`aria-label="Sign in. ${SIGN_IN_REASON}"`));
    assert.equal(SIGN_IN_REASON, "Enter your username and password.");
    assert.ok((html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "").includes('disabled=""'));
  });
});
