import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { StreamStatusGroup } from "@/components/channels/StreamStatusGroup";
import { STATUS_OPTIONS } from "@/constants/channel-query-copy";
import { channelRow } from "@/lib/channel-rows";
import { DEFAULT_CHANNEL_QUERY, isDefaultQuery, pagePath, queryKey, withFilter } from "@/lib/channel-query";
import { streamStatusState } from "@/lib/row-state";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { ChannelSchema } from "@/services/schemas/channel-schema";
import { holdChannels } from "./support/channels-hold";
import { live, stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const params = (path: string): Record<string, string> => Object.fromEntries(new URL(path, "http://x").searchParams);
const group = (channel: ReturnType<typeof stream>) =>
  renderLive(createElement(StreamStatusGroup, { channel, revertReason: undefined, onRevert: () => undefined }));

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the stream status filter", () => {
  it("is a parameter of the page request, absent while it is Any status", () => {
    assert.equal(params(pagePath(DEFAULT_CHANNEL_QUERY, 0))["status"], undefined);
    for (const value of ["live", "dead", "unchecked"] as const) {
      assert.equal(params(pagePath({ ...DEFAULT_CHANNEL_QUERY, status: value }, 0))["status"], value);
    }
  });

  it("is part of the query key, so a result for another status is dropped", () => {
    const dead = { ...DEFAULT_CHANNEL_QUERY, status: "dead" } as const;
    assert.notEqual(queryKey(dead), queryKey(DEFAULT_CHANNEL_QUERY));
    assert.equal(isDefaultQuery(dead), false);
  });

  it("offers Any status, Live, Dead and Not checked, and a choice clears the contradicting Live kind and State", () => {
    assert.deepEqual(STATUS_OPTIONS.map((one) => [one.value, one.label]), [
      ["all", "Any status"], ["live", "Live"], ["dead", "Dead"], ["unchecked", "Not checked"],
    ]);
    const onLive = withFilter(withFilter(DEFAULT_CHANNEL_QUERY, "state", "failed"), "status", "dead");
    assert.deepEqual([onLive.kind, onLive.state, onLive.status], ["stream", "all", "dead"]);
    const back = withFilter(onLive, "kind", "live");
    assert.deepEqual([back.kind, back.status], ["live", "all"]);
    assert.equal(withFilter(onLive, "state", "live").status, "all");
  });
});

describe("the stream column", () => {
  it("words a stream row live, dead or not checked, with the failed tone for dead and faint for not checked", () => {
    const tones = (status?: "live" | "dead") => {
      const row = streamStatusState(status);
      return [row.word, row.tone, row.dimmed];
    };
    assert.deepEqual(tones("live"), ["live", "done", false]);
    assert.deepEqual(tones("dead"), ["dead", "failed", false]);
    assert.deepEqual(tones(undefined), ["not checked", "faint", false]);
    assert.equal(streamStatusState("dead").hint, "No HLS manifest at this address");
  });

  it("is blank on a live-kind row and the sync's verdict on a stream row", () => {
    assert.equal(channelRow(live("a")).stream, null);
    assert.equal(channelRow(stream("a")).stream?.word, "not checked");
    assert.equal(channelRow(stream("b", { status: "dead", checkedAt: 5 })).stream?.word, "dead");
    assert.equal(channelRow(stream("c", { status: "live", enabled: false })).stream?.word, "live", "a disabled row keeps its verdict");
  });

  it("is drawn after `state` in the list: a heading `stream`, one word per stream row, nothing for a live row", () => {
    holdChannels([live("l"), stream("a", { status: "live" }), stream("b", { status: "dead" }), stream("c")], 1);
    const html = renderLive(createElement(ChannelsPage, { active: true }));
    assert.ok(html.indexOf(">state<") < html.indexOf(">stream<") && html.indexOf(">stream<") < html.indexOf(">mode<"));
    for (const word of ["live", "dead", "not checked"]) assert.ok(html.includes(`data-st="${word}"`), word);
    assert.equal(html.split('data-st="dead"').length - 1, 1);
    assert.equal(html.split('data-st="not checked"').length - 1, 1);
  });
});

describe("a stream channel's Status group", () => {
  it("adds Stream (the word), Checked (the time) and Logo (a box) after Synced from", () => {
    const html = group(stream("s", { status: "dead", checkedAt: new Date(2026, 9, 18, 6, 30).getTime() }));
    const at = (needle: string): number => {
      assert.ok(html.includes(needle), needle);
      return html.indexOf(needle);
    };
    assert.ok(at(">Synced from<") < at(">Stream<") && at(">Stream<") < at(">Checked<") && at(">Checked<") < at(">Logo<"));
    assert.ok(html.includes('data-st="dead"') && html.includes("2026-10-18 06:30"));
    assert.ok(html.includes("size-14"), "the logo box is 56px");
  });

  it("reads `not checked` and `never` before any check, and a glyph in the logo box with no cached copy", () => {
    const html = group(stream("s"));
    assert.ok(html.includes('data-st="not checked"') && html.includes(">never<"));
    assert.ok(html.includes('data-logo="none"') && html.includes("lucide-image") && !html.includes("<img"));
  });

  it("shows the cached logo when the backend names one", () => {
    const html = group(stream("s", { cachedLogoUrl: "/logos/c/0123456789abcdef0123456789abcdef.png" }));
    assert.ok(html.includes('data-logo="cached"') && html.includes('src="/logos/c/0123456789abcdef0123456789abcdef.png"'));
  });
});

describe("the wire", () => {
  it("reads status, checkedAt and cachedLogoUrl on a stream row, and a row without them", () => {
    const full = ChannelSchema.parse({ ...stream("s"), status: "live", checkedAt: 9, cachedLogoUrl: "/logos/c/a.png" });
    assert.deepEqual([full.kind === "stream" && full.status, full.kind === "stream" && full.checkedAt], ["live", 9]);
    assert.equal(ChannelSchema.safeParse(stream("t")).success, true);
    assert.equal(ChannelSchema.safeParse({ ...stream("u"), status: "unknown" }).success, false);
  });
});
