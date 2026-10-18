import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { StreamStatusGroup } from "@/components/channels/StreamStatusGroup";
import { STATUS_OPTIONS } from "@/constants/channel-query-copy";
import { channelRow } from "@/lib/channel-rows";
import { DEFAULT_CHANNEL_QUERY, isDefaultQuery, pagePath, queryKey, statusFilterOf, withFilter } from "@/lib/channel-query";
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
    for (const value of ["online", "offline", "unchecked"] as const) {
      assert.equal(params(pagePath({ ...DEFAULT_CHANNEL_QUERY, status: value }, 0))["status"], value);
    }
  });

  it("is part of the query key, so a result for another status is dropped", () => {
    const offline = { ...DEFAULT_CHANNEL_QUERY, status: "offline" } as const;
    assert.notEqual(queryKey(offline), queryKey(DEFAULT_CHANNEL_QUERY));
    assert.equal(isDefaultQuery(offline), false);
  });

  it("offers Any status, Online, Offline and Not checked, and a choice clears the contradicting Live kind and State", () => {
    assert.deepEqual(STATUS_OPTIONS.map((one) => [one.value, one.label]), [
      ["all", "Any status"], ["online", "Online"], ["offline", "Offline"], ["unchecked", "Not checked"],
    ]);
    const onStream = withFilter(withFilter(DEFAULT_CHANNEL_QUERY, "state", "failed"), "status", "offline");
    assert.deepEqual([onStream.kind, onStream.state, onStream.status], ["stream", "all", "offline"]);
    const back = withFilter(onStream, "kind", "live");
    assert.deepEqual([back.kind, back.status], ["live", "all"]);
    assert.equal(withFilter(onStream, "state", "live").status, "all");
  });

  it("a stale saved filter holding a legacy `live` or `dead` reads as `all` at the one place the request is built", () => {
    assert.deepEqual([statusFilterOf("live"), statusFilterOf("dead"), statusFilterOf("odd")], ["all", "all", "all"]);
    assert.deepEqual(
      [statusFilterOf("all"), statusFilterOf("online"), statusFilterOf("offline"), statusFilterOf("unchecked")],
      ["all", "online", "offline", "unchecked"],
    );
    assert.equal(
      params(pagePath({ ...DEFAULT_CHANNEL_QUERY, status: statusFilterOf("dead") }, 0))["status"],
      undefined,
      "a legacy `dead` filter asks for no status at all",
    );
  });
});

describe("the stream column", () => {
  it("words a stream row online, offline or not checked, with the failed tone for offline and faint for not checked", () => {
    const tones = (status?: "online" | "offline") => {
      const row = streamStatusState(status);
      return [row.word, row.tone, row.dimmed];
    };
    assert.deepEqual(tones("online"), ["online", "done", false]);
    assert.deepEqual(tones("offline"), ["offline", "failed", false]);
    assert.deepEqual(tones(undefined), ["not checked", "faint", false]);
    assert.equal(streamStatusState("offline").hint, "No HLS manifest at this address");
    assert.equal(streamStatusState("online").hint, "The address answered with an HLS manifest");
  });

  it("is blank on a live-kind row and the sync's verdict on a stream row", () => {
    assert.equal(channelRow(live("a")).stream, null);
    assert.equal(channelRow(stream("a")).stream?.word, "not checked");
    assert.equal(channelRow(stream("b", { status: "offline", checkedAt: 5 })).stream?.word, "offline");
    assert.equal(channelRow(stream("c", { status: "online", enabled: false })).stream?.word, "online", "a disabled row keeps its verdict");
  });

  it("is drawn after `state` in the list: a heading `stream`, one word per stream row, nothing for a live row", () => {
    holdChannels([live("l"), stream("a", { status: "online" }), stream("b", { status: "offline" }), stream("c")], 1);
    const html = renderLive(createElement(ChannelsPage, { active: true }));
    assert.ok(html.indexOf(">state<") < html.indexOf(">stream<") && html.indexOf(">stream<") < html.indexOf(">mode<"));
    for (const word of ["online", "offline", "not checked"]) assert.ok(html.includes(`data-st="${word}"`), word);
    assert.equal(html.split('data-st="offline"').length - 1, 1);
    assert.equal(html.split('data-st="not checked"').length - 1, 1);
  });
});

describe("a stream channel's Status group", () => {
  it("adds Stream (the word), Checked (the time) and Logo (a box) after Synced from", () => {
    const html = group(stream("s", { status: "offline", checkedAt: new Date(2026, 9, 18, 6, 30).getTime() }));
    const at = (needle: string): number => {
      assert.ok(html.includes(needle), needle);
      return html.indexOf(needle);
    };
    assert.ok(at(">Synced from<") < at(">Stream<") && at(">Stream<") < at(">Checked<") && at(">Checked<") < at(">Logo<"));
    assert.ok(html.includes('data-st="offline"') && html.includes("2026-10-18 06:30"));
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
    const full = ChannelSchema.parse({ ...stream("s"), status: "online", checkedAt: 9, cachedLogoUrl: "/logos/c/a.png" });
    assert.deepEqual([full.kind === "stream" && full.status, full.kind === "stream" && full.checkedAt], ["online", 9]);
    assert.equal(ChannelSchema.safeParse(stream("t")).success, true);
    assert.equal(ChannelSchema.safeParse({ ...stream("u"), status: "unknown" }).success, false);
    assert.equal(ChannelSchema.safeParse({ ...stream("v"), status: "live" }).success, false, "the legacy word is refused");
    assert.equal(ChannelSchema.safeParse({ ...stream("w"), status: "dead" }).success, false, "the legacy word is refused");
  });
});
