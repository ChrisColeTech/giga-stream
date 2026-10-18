import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewToolbar, type PreviewToolbarProps } from "@/components/channels/PreviewToolbar";
import { PreviewWindow } from "@/components/channels/PreviewWindow";
import { UNREACHABLE_REASON } from "@/constants/channel-copy";
import { RETRY_READING } from "@/constants/preview-copy";
import { previewChannel } from "@/lib/channel-list";
import { queryKey } from "@/lib/channel-query";
import { previewVerbs, verdictToSet, type VerbContext } from "@/lib/preview-verbs";
import { FIRST_REASON } from "@/lib/preview-walk";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { live, stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const CALM: VerbContext = { reading: false, unreachable: false, busy: false, playerFailed: false };
const noop = (): void => undefined;

function props(channel: AdminChannel | undefined, over: Partial<PreviewToolbarProps> = {}): PreviewToolbarProps {
  return {
    name: channel?.name,
    reading: false,
    walk: { position: 2, total: 5, reasons: { previous: undefined, next: undefined }, step: noop },
    line: "live",
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

describe("the Preview toolbar", () => {
  it("draws Previous, Next, `N / total`, the name, the state word, then Enable/Disable, Mark and Retry, in that order", () => {
    const html = toolbar(stream("a", { name: "Talk", status: "live" }), { retry: true, line: "failed" });
    const at = order(html, ['aria-label="Previous"', 'aria-label="Next"', "2 / 5", ">Talk<", ">failed<", ">Disable<", ">Mark dead<", ">Retry<"]);
    assert.ok(at.every((index) => index >= 0), JSON.stringify(at));
    assert.deepEqual([...at].sort((x, y) => x - y), at, "the order is the specified one");
    assert.ok(html.includes("border-b border-hair"), "the shared pinned strip");
    assert.ok(html.includes('title="Talk"'), "the name truncates with a tooltip");
  });

  it("shows the action the channel can take, and the other verdict than its own (a stream channel only)", () => {
    assert.ok(toolbar(stream("a", { enabled: false, status: "dead" })).includes(">Enable<"));
    assert.ok(toolbar(stream("a", { enabled: false, status: "dead" })).includes(">Mark live<"));
    assert.ok(toolbar(stream("a", { status: "live" })).includes(">Mark dead<"));
    const liveHtml = toolbar(live("a"));
    assert.ok(liveHtml.includes(">Disable<") && !liveHtml.includes("Mark "), "a live channel has no Mark button at all");
  });

  it("takes the player's word for a stream nobody has checked", () => {
    assert.deepEqual([verdictToSet(stream("a"), false), verdictToSet(stream("a"), true)], ["live", "dead"]);
  });

  it("offers Retry only when told to, and disables Previous with its reason as the tooltip", () => {
    const reasons = { previous: FIRST_REASON, next: undefined };
    const html = toolbar(stream("a"), { walk: { position: 1, total: 5, reasons, step: noop } });
    assert.ok(html.includes(`Previous. ${FIRST_REASON}`));
    assert.ok(!html.includes(">Retry<"));
  });

  it("disables the verbs with their reasons: reading, no channel, unreachable, busy", () => {
    const s = stream("a");
    assert.equal(previewVerbs(s, { ...CALM, reading: true }).enable.reason, RETRY_READING);
    assert.equal(previewVerbs(undefined, CALM).enable.reason, "That channel does not exist.");
    assert.equal(previewVerbs(undefined, CALM).mark, null);
    assert.equal(previewVerbs(s, { ...CALM, unreachable: true }).mark?.reason, UNREACHABLE_REASON);
    assert.equal(previewVerbs(s, { ...CALM, busy: true }).enable.reason, "Saving.");
    assert.equal(previewVerbs(s, CALM).enable.reason, undefined);
    const html = toolbar(s, { verbs: { plan: previewVerbs(s, { ...CALM, unreachable: true }), toggleEnabled: noop, mark: noop } });
    assert.ok(html.includes(`Disable. ${UNREACHABLE_REASON}`) && html.includes(`Mark live. ${UNREACHABLE_REASON}`));
  });

  it("wears shimmers, not words, for the place and the name while the channels are read", () => {
    const html = toolbar(undefined, { reading: true, walk: { position: null, total: 0, reasons: { previous: RETRY_READING, next: RETRY_READING }, step: noop } });
    assert.ok(!html.includes("0 / 0") && !html.includes("–"));
    assert.ok(html.split("aria-hidden").length > 4);
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
    assert.ok(html.indexOf("Preview window") >= 0 && video > 0);
    assert.ok(html.indexOf('aria-label="Previous"') > html.indexOf("Close Preview"), "the strip is under the header");
    assert.ok(html.indexOf('aria-label="Previous"') < video && html.indexOf('role="status"') < video);
    const below = html.slice(html.indexOf("</video>"));
    assert.ok(!below.includes("<button") && !below.includes('role="status"'), "no row under the stage");
  });
});

describe("the toolbar's flows update the row and the window together", () => {
  it("replaces the window's copy when the row is answered, even with the list's pages dropped", () => {
    state().channelsPageLoaded(queryKey(state().channels.query), 0, [stream("a"), stream("b")], 500, 1);
    state().channelsOpenPreview("a");
    state().channelsInvalidate();
    state().channelUpsert(stream("a", { status: "dead", checkedAt: 9, enabled: false }));
    const held = previewChannel(state().channels, "a");
    assert.deepEqual([held?.kind === "stream" && held.status, held?.enabled], ["dead", false]);
  });
});
