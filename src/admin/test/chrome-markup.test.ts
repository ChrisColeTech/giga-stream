import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { AdminEventsDrawer } from "@/components/chrome/AdminEventsDrawer";
import { AdminStatusbar } from "@/components/chrome/AdminStatusbar";
import { AdminTitlebar } from "@/components/chrome/AdminTitlebar";
import { AppShell } from "@/components/chrome/AppShell";
import {
  NO_LEFT_PANE,
  NO_RIGHT_PANE,
  SLEEPING_PANES,
  SLEEPING_TABS,
  STOP_BUILD,
  STOP_IDLE,
} from "@/constants/record-copy";
import { TABS } from "@/constants/tabs";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore } from "./support/store";

const state = () => useAppStore.getState();
const count = (html: string, needle: string) => html.split(needle).length - 1;
const toggle = (html: string, label: string): string =>
  html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
const tab = (html: string, label: string): string =>
  html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";

beforeEach(() => {
  resetStore();
});

describe("the titlebar", () => {
  it("draws the brand tagged ADMIN and the six tabs in the pill's order, each titled with its Ctrl hint", () => {
    const html = renderLive(createElement(AdminTitlebar));
    assert.ok(html.indexOf("STREAM") < html.indexOf(">ADMIN<"));
    const at = TABS.map((item) => html.indexOf(`>${item.label}</button>`));
    assert.deepEqual([...at].sort((a, b) => a - b), at);
    assert.ok(at.every((place) => place > 0));
    TABS.forEach((item) => assert.ok(tab(html, item.label).includes(`title="${item.hint}"`), item.label));
    assert.ok(tab(html, "Channels").includes('data-active=""'));
    assert.equal(count(html, 'data-active=""'), 1);
  });

  it("lights the tab that is shown", () => {
    state().setTab("jobs");
    const html = renderLive(createElement(AdminTitlebar));
    assert.ok(tab(html, "Jobs").includes('data-active=""'));
    assert.ok(!tab(html, "Channels").includes('data-active=""'));
  });

  it("disables the rail toggle on an index and the right toggle always, each with its reason", () => {
    const html = renderLive(createElement(AdminTitlebar));
    for (const [label, reason] of [["Toggle left pane", NO_LEFT_PANE], ["Toggle right pane", NO_RIGHT_PANE]] as const) {
      assert.ok(toggle(html, label).includes('disabled=""'), label);
      assert.ok(html.includes(`<span class="inline-flex" title="${reason}">`), reason);
    }
  });

  it("enables the rail toggle on a workspace, lit while the rail is open", () => {
    state().openWorkspace("channels", "ch-1");
    const open = toggle(renderLive(createElement(AdminTitlebar)), "Toggle left pane");
    assert.ok(!open.includes('disabled=""') && open.includes('aria-pressed="true"'));
    state().togglePane("left");
    const shut = toggle(renderLive(createElement(AdminTitlebar)), "Toggle left pane");
    assert.ok(shut.includes('aria-pressed="false"'));
  });

  it("puts the Events toggle in the bottom toggle's place, lit while the drawer is open", () => {
    const closed = toggle(renderLive(createElement(AdminTitlebar)), "Toggle the events band");
    assert.ok(closed.includes('aria-pressed="false"') && !closed.includes('disabled=""'));
    state().toggleEvents();
    assert.ok(toggle(renderLive(createElement(AdminTitlebar)), "Toggle the events band").includes('aria-pressed="true"'));
  });

  it("puts the tabs and the toggles to sleep under a window, with the reason on the track", () => {
    state().openOverlay("settings");
    const html = renderLive(createElement(AdminTitlebar));
    assert.ok(html.includes(`title="${SLEEPING_TABS}"`));
    assert.equal(count(html, ">Channels</button>") + count(html, ">Accounts</button>"), 2);
    assert.ok(tab(html, "Titles").includes('disabled=""'));
    assert.ok(toggle(html, "Toggle the events band").includes('disabled=""'));
    assert.ok(html.includes(`title="${SLEEPING_PANES}"`));
  });

  it("puts the tabs to sleep with `Sign in first` while signed out", () => {
    state().signOut();
    const html = renderLive(createElement(AdminTitlebar));
    assert.ok(html.includes('title="Sign in first"'));
    for (const item of TABS) assert.ok(tab(html, item.label).includes('disabled=""'), item.label);
    assert.equal(count(html, 'data-active=""'), 0);
  });
});

describe("the statusbar", () => {
  it("is idle: an empty track, Stop disabled with `Nothing to stop`, the two doors, and no notice", () => {
    const html = renderLive(createElement(AdminStatusbar));
    assert.ok(html.includes(">idle</span>") && html.includes("width:0%"));
    assert.ok(html.includes(`aria-label="Stop. ${STOP_IDLE}"`));
    assert.ok(html.includes("Events") && html.includes("Settings"));
    assert.ok(!html.includes('role="status"'), "a notice appears when something says one, and not before");
  });

  it("counts the work as `N preparing` over a full pulsing bar and says why Stop cannot stop it", () => {
    state().setWork({ preparing: 2 });
    const html = renderLive(createElement(AdminStatusbar));
    assert.ok(html.includes(">2 preparing</span>") && html.includes("width:100%") && html.includes("animate-pulse-busy"));
    assert.ok(html.includes(`aria-label="Stop. ${STOP_BUILD}"`));
    assert.ok((html.match(/<button[^>]*>/)?.[0] ?? "").includes('disabled=""'));
  });

  it("shows a refusal on the one notice line", () => {
    state().say("Number must be a whole number from 1 to 9999.", "warn");
    const html = renderLive(createElement(AdminStatusbar));
    assert.ok(html.includes('role="status"') && html.includes("Number must be a whole number"));
  });

  it("lights the Events door while the drawer is open", () => {
    state().toggleEvents();
    assert.ok(renderLive(createElement(AdminStatusbar)).includes('aria-pressed="true"'));
  });
});

describe("the events drawer", () => {
  it("holds the audit rows and the page's, with `Load older` at the top, closed and hidden from the tab order", () => {
    const html = renderLive(createElement(AdminEventsDrawer));
    assert.ok(html.includes("14 events"));
    assert.ok(html.indexOf("Load older") < html.indexOf("ada@example.test signed in"));
    assert.ok(html.includes('aria-hidden="true"') && html.includes("inert"));
    assert.ok(html.includes("Sign-in failed for eve@example.test"));
  });

  it("empties to five shimmer lines on Clear, with no sentence, and Clear disabled", () => {
    state().clearEvents();
    const html = renderLive(createElement(AdminEventsDrawer));
    assert.ok(html.includes("0 events"));
    assert.equal(count(html, "animate-skel-shimmer"), 5);
    assert.ok(html.includes("The log is empty."));
  });

  it("disables `Load older` with `No older events.` once every older page is in", () => {
    state().loadOlder();
    state().loadOlder();
    const html = renderLive(createElement(AdminEventsDrawer));
    assert.ok(html.includes("22 events"));
    assert.ok(html.includes('title="No older events."'));
  });

  it("opens: not hidden, reachable", () => {
    state().toggleEvents();
    assert.ok(renderLive(createElement(AdminEventsDrawer)).includes('aria-hidden="false"'));
  });
});

describe("the shell", () => {
  it("keeps all six tab pages mounted and hides all but the active one", () => {
    const html = renderLive(createElement(AppShell));
    for (const item of TABS) assert.equal(count(html, `<section aria-label="${item.label}"`), 1, item.label);
    assert.equal(count(html, "flex min-h-0 min-w-0 flex-1 flex-col hidden"), 5);
    state().setTab("titles");
    const later = renderLive(createElement(AppShell));
    assert.equal(count(later, "flex min-h-0 min-w-0 flex-1 flex-col hidden"), 5);
    assert.ok(/<section aria-label="Channels" class="[^"]*hidden"/.test(later), "Channels is still there, hidden");
    assert.ok(!/<section aria-label="Titles" class="[^"]*hidden"/.test(later));
  });

  it("holds 900 x 640 and scrolls inside a smaller window", () => {
    const html = renderLive(createElement(AppShell));
    assert.ok(html.startsWith('<div class="h-full w-full overflow-auto">'));
    assert.ok(html.includes("min-width:900px") && html.includes("min-height:640px"));
  });

  it("shows the sign-in page in place of the tab pages while signed out, the chrome still in place", () => {
    state().signOut();
    const html = renderLive(createElement(AppShell));
    assert.ok(html.includes('aria-label="Sign in"'));
    for (const item of TABS) assert.equal(count(html, `<section aria-label="${item.label}"`), 0, item.label);
    assert.ok(html.includes(">ADMIN<") && html.includes("<footer") && html.includes("<header"));
  });

  it("never asks the network for anything", () => {
    const html = renderLive(createElement(AppShell));
    assert.ok(!html.includes("/api") && !html.includes("<img") && !html.includes("placeholder"));
  });
});
