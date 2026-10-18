import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewToolbar, type PreviewToolbarProps } from "@/components/channels/PreviewToolbar";
import { PreviewWindow } from "@/components/channels/PreviewWindow";
import { UNREACHABLE_REASON } from "@/constants/channel-copy";
import { RETRY_READING, UNCHECKED_TITLE } from "@/constants/preview-copy";
import { previewChannel } from "@/lib/channel-list";
import { queryKey } from "@/lib/channel-query";
import { previewVerbs, type VerbContext } from "@/lib/preview-verbs";
import { FIRST_REASON } from "@/lib/preview-walk";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { live, stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const CALM: VerbContext = { reading: false, unreachable: false, busy: false };
const noop = (): void => undefined;

function props(channel: AdminChannel | undefined, over: Partial<PreviewToolbarProps> = {}): PreviewToolbarProps {
  return {
    walk: { position: 2, total: 5, reasons: { previous: undefined, next: undefined }, step: noop },
    retry: false,
    onRetry: noop,
    verbs: { plan: previewVerbs(channel, CALM), toggleEnabled: noop, mark: noop },
    ...over,
  };
}
const toolbar = (channel: AdminChannel | undefined, over: Partial<PreviewToolbarProps> = {}): string =>
  renderToStaticMarkup(createElement(PreviewToolbar, props(channel, over)));
const order = (html: string, parts: readonly string[]): number[] => parts.map((part) => html.indexOf(part));

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the Preview toolbar's two toggles (`51` section 2.6)", () => {
  it("draws `Enabled` and `Online` as family switches with plain labels beside them, then Retry; no Enable/Disable or Mark button", () => {
    const html = toolbar(stream("a", { name: "Talk", status: "online" }), { retry: true });
    const at = order(html, [
      'aria-label="Enabled"', ">Enabled</span>", 'aria-label="Online"', ">Online</span>", ">Retry<",
      'aria-label="Previous"', 'aria-label="Next"',
    ]);
    assert.ok(!html.includes(">Enable<") && !html.includes(">Disable<"), "no prose verb for the enabled boolean");
    assert.ok(!html.includes("Mark "), "no Mark button at all");
    assert.ok(at.every((index) => index >= 0), JSON.stringify(at));
    assert.ok(html.includes('role="switch"') && html.includes('aria-checked="true"'), "the family Toggle");
    assert.ok(html.includes("lucide-check") === false, "no Check/X icon on a switch");
    assert.ok(html.includes("border-b border-hair"), "the shared pinned strip");
  });

  it("reads each switch from the channel: Enabled from `enabled`, Online from `status`", () => {
    const both = toolbar(stream("a", { enabled: false, status: "online" }));
    assert.ok(both.includes('aria-checked="false"'), "Enabled off");
    const on = toolbar(stream("a", { status: "online" }));
    const off = toolbar(stream("a", { status: "offline" }));
    const checked = (html: string): string[] =>
      [...html.matchAll(/aria-checked="(\w+)"[^>]*aria-label="(Enabled|Online)"/g)].map((hit) => `${hit[2]}=${hit[1]}`);
    assert.deepEqual(checked(on), ["Enabled=true", "Online=true"]);
    assert.deepEqual(checked(off), ["Enabled=true", "Online=false"], "a disabled channel still shows its own switch state");
  });

  it("Online is absent, not disabled, for a live-kind channel or no channel", () => {
    const liveHtml = toolbar(live("a"));
    assert.ok(liveHtml.includes('aria-label="Enabled"') && !liveHtml.includes('aria-label="Online"'));
    assert.equal(previewVerbs(live("a"), CALM).online, null);
    assert.equal(previewVerbs(undefined, CALM).online, null);
  });

  it("a stream nobody has checked shows Online off, with the note as the switch's title", () => {
    const plan = previewVerbs(stream("a"), CALM);
    assert.deepEqual([plan.online?.checked, plan.online?.reason, plan.online?.title], [false, undefined, UNCHECKED_TITLE]);
    assert.ok(toolbar(stream("a")).includes(`title="${UNCHECKED_TITLE}"`));
    const checked = previewVerbs(stream("a", { status: "online" }), CALM);
    assert.equal(checked.online?.title, undefined, "a checked stream needs no note");
  });

  it("disables the switches with their reasons as wrapper tooltips: reading, no channel, unreachable, busy", () => {
    const s = stream("a");
    assert.equal(previewVerbs(s, { ...CALM, reading: true }).enabled.reason, RETRY_READING);
    assert.equal(previewVerbs(undefined, CALM).enabled.reason, "That channel does not exist.");
    assert.equal(previewVerbs(s, { ...CALM, unreachable: true }).online?.reason, UNREACHABLE_REASON);
    assert.equal(previewVerbs(s, { ...CALM, busy: true }).enabled.reason, "Saving.");
    assert.equal(previewVerbs(s, CALM).enabled.reason, undefined);
    const html = toolbar(s, { verbs: { plan: previewVerbs(s, { ...CALM, unreachable: true }), toggleEnabled: noop, mark: noop } });
    assert.ok(html.includes(`Enabled. ${UNREACHABLE_REASON}`) && html.includes(`Online. ${UNREACHABLE_REASON}`));
    assert.ok(html.split('disabled=""').length - 1 === 2, "both switches natively disabled");
  });

  it("offers Retry only when told to, and disables Previous with its reason as the tooltip", () => {
    const reasons = { previous: FIRST_REASON, next: undefined };
    const html = toolbar(stream("a"), { walk: { position: 1, total: 5, reasons, step: noop } });
    assert.ok(html.includes(`Previous. ${FIRST_REASON}`));
    assert.ok(!html.includes(">Retry<"));
  });
});

describe("the Preview window", () => {
  before(() => {
    const none = (): void => undefined;
    Reflect.set(globalThis, "window", { innerWidth: 1600, innerHeight: 1000, addEventListener: none, removeEventListener: none });
  });
  after(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("has the toolbar under the header and nothing under the stage", () => {
    state().channelsPageLoaded(queryKey(state().channels.query), 0, [stream("a"), stream("b")], 2, 1);
    state().channelsOpenPreview("a");
    const html = renderLive(createElement(PreviewWindow));
    const video = html.indexOf("<video");
    assert.ok(html.indexOf("Stream a window") >= 0 && video > 0);
    assert.ok(/<h2[^>]*>Stream a<\/h2>/.test(html), "the title bar is the channel's name");
    const bar = html.slice(html.indexOf("data-child-status"));
    assert.ok(html.indexOf("data-child-status") > html.indexOf("</video>"), "the status bar is the last row, under the stage");
    assert.ok(bar.includes('role="status"') && /1 \/ 2/.test(bar), "the state word and the count are in the status bar");
    assert.ok(html.indexOf('role="status"') > video, "and not in the toolbar");
    assert.ok(html.includes('aria-label="Maximize Stream a"'), "the window gained the maximize button");
    assert.ok(!html.includes(">Preview<"), "never the word Preview");
    state().channelsOpenPreview("elsewhere");
    const reading = renderLive(createElement(PreviewWindow));
    assert.ok(/<h2[^>]*><span[^>]*aria-hidden/.test(reading) && !/<h2[^>]*>Preview</.test(reading), "a shimmer while read");
    assert.ok(/data-child-status[^]*animate-skel-shimmer/.test(reading), "the count is a shimmer pill while read");
    assert.ok(html.indexOf('aria-label="Previous"') > html.indexOf("Close Stream a"), "the strip is under the header");
    assert.ok(html.indexOf('aria-label="Previous"') < video);
    const below = html.slice(html.indexOf("</video>"));
    assert.ok(!below.includes("<button"), "no controls under the stage");
  });

  it("the status bar's health word stands before the play state, separated as the line separates (`51` section 2.5)", () => {
    state().channelsPageLoaded(queryKey(state().channels.query), 0, [stream("a", { status: "online" }), stream("b")], 2, 1);
    state().channelsOpenPreview("a");
    const html = renderLive(createElement(PreviewWindow));
    const left = (page: string, closes: 1 | 2): string => {
      const at = page.indexOf('role="status"');
      let end = at;
      for (let rest = closes; rest > 0; rest -= 1) end = page.indexOf("</span>", end) + 7;
      return page.slice(at, end);
    };
    assert.equal(left(html, 2), '<span role="status"><span>online</span> · loading</span>');
    state().channelUpsert(stream("b", { status: "offline" }));
    state().channelsOpenPreview("b");
    const off = renderLive(createElement(PreviewWindow));
    assert.equal(left(off, 2), '<span role="status"><span class="text-st-failed">offline</span> · loading</span>');
    state().channelUpsert(stream("a"));
    state().channelsOpenPreview("a");
    const unchecked = renderLive(createElement(PreviewWindow));
    assert.equal(left(unchecked, 2), '<span role="status"><span class="text-faint">not checked</span> · loading</span>');
  });

  it("a live-kind channel shows no health word: its engine word stands alone", () => {
    state().channelsPageLoaded(queryKey(state().channels.query), 0, [live("a")], 1, 1);
    state().channelsOpenPreview("a");
    const html = renderLive(createElement(PreviewWindow));
    const at = html.indexOf('role="status"');
    const left = html.slice(at, html.indexOf("</span>", at) + 7);
    assert.equal(left, '<span role="status">loading</span>', "no health word, no separator");
    assert.ok(!/online|offline|not checked/.test(left));
  });
});

describe("the toolbar's flows update the row and the window together", () => {
  it("replaces the window's copy when the row is answered, even with the list's pages dropped", () => {
    state().channelsPageLoaded(queryKey(state().channels.query), 0, [stream("a"), stream("b")], 500, 1);
    state().channelsOpenPreview("a");
    state().channelsInvalidate();
    state().channelUpsert(stream("a", { status: "offline", checkedAt: 9, enabled: false }));
    const held = previewChannel(state().channels, "a");
    assert.deepEqual([held?.kind === "stream" && held.status, held?.enabled], ["offline", false]);
  });
});
