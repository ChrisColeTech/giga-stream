import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { LiveDetailsGroup } from "@/components/channels/LiveDetailsGroup";
import { LiveStatusGroup } from "@/components/channels/LiveStatusGroup";
import { PlaybackGroup } from "@/components/channels/PlaybackGroup";
import { liveDraft } from "@/lib/channel-draft";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { useAppStore } from "@/store/app-store";
import type { LiveAdminChannel } from "@/types/admin-channel";
import { live } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const page = (): string => renderLive(createElement(ChannelsPage, { active: true }));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};
const details = (channel: LiveAdminChannel, overrides: Partial<ReturnType<typeof liveDraft>> = {}) =>
  renderLive(
    createElement(LiveDetailsGroup, {
      channel,
      draft: { ...liveDraft(channel), ...overrides },
      errors: {},
      onChange: () => undefined,
      chooseReason: undefined,
      onChoose: () => undefined,
    }),
  );
const status = (channel: LiveAdminChannel, rebuildReason?: string, refreshReason?: string) =>
  renderLive(
    createElement(LiveStatusGroup, {
      channel,
      refreshReason,
      onRefresh: () => undefined,
      rebuildReason,
      onRebuild: () => undefined,
      onCopy: () => undefined,
    }),
  );

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("a live channel's workspace", () => {
  it("opens from the held list: the rail, the groups, the pinned Discard, Save details and the Preview arrow", () => {
    state().channelsLoaded([live("a")], 1);
    state().openWorkspace("channels", "a");
    const html = page();
    assert.ok(html.includes('aria-label="Channel sections"'));
    for (const [before, after] of [
      [">Details<", ">Playback<"],
      [">Playback<", ">Status<"],
    ]) {
      assert.ok(at(html, before) < at(html, after), `${before} before ${after}`);
    }
    assert.ok(html.includes('aria-label="Discard changes. Nothing has changed."'));
    assert.ok(html.includes('aria-label="Save details. Nothing has changed."'));
    assert.ok(at(html, "Save details") > at(html, 'id="lv-playback"') && at(html, "Save details") < at(html, 'id="lv-status"'));
    assert.ok(/<button[^>]*aria-label="Preview channel"[^>]*>/.test(html), "a saved channel previews, by the arrow icon");
  });

  it("draws Details in order: Name, Kind, Category, Plays, Folder, Enabled, Logo, Id", () => {
    const html = details(live("a"));
    const order = ["Name", "Kind", "Category", "Plays", "Folder", "Enabled", "Logo", "Id"].map((label) =>
      at(html, `<span class="truncate">${label}</span>`),
    );
    assert.ok(order.every((value, index) => index === 0 || value > (order[index - 1] ?? 0)), String(order));
    assert.ok(html.includes('value="Live"') && html.includes('readOnly=""') && html.includes('value="a"'));
    assert.ok(html.includes('src="/logos/a.png"'), "the logo on the page's own origin");
    assert.ok(html.includes('role="switch"') && html.includes("Choose"));
  });

  it("switches Plays to the ordered Videos list in place of the Folder row", () => {
    const html = details(live("a"), { plays: "videos", videos: ["D:\\x.mp4", "D:\\y.mp4"] });
    assert.ok(html.includes('aria-label="Videos"') && html.includes('aria-label="Move D:\\x.mp4 up. Already first"'));
    assert.ok(!html.includes('aria-label="Folder"'));
  });

  it("gives Rebuild its reason as the Status group's ghost verb, and Refresh status its icon; none is in a heading", () => {
    assert.ok(status(live("a"), "Save the channel first").includes('aria-label="Rebuild. Save the channel first"'));
    assert.ok(/<button[^>]*>.*?Rebuild<\/button>/.test(status(live("a"))));
    assert.ok(status(live("a"), undefined, "Loading.").includes('aria-label="Refresh status. Loading."'));
    assert.ok(/<button[^>]*aria-label="Refresh status"[^>]*title="Refresh status"/.test(status(live("a"))));
    assert.ok(!details(live("a")).includes("Rebuild"));
  });

  it("keeps two qualities: the last two lit chips are locked with the reason", () => {
    const html = renderLive(
      createElement(PlaybackGroup, { draft: liveDraft(live("a")), onChange: () => undefined, save: { onPress: () => undefined } }),
    );
    assert.ok(html.includes(">Save details<"), "the form's commit ends this last editable group");
    assert.ok(html.includes('aria-label="Mode"') && html.includes(">Encode</button>") && html.includes('aria-label="Captions"'));
    assert.equal((html.match(/title="A channel keeps at least two qualities\."/g) ?? []).length, 2);
    assert.ok(/aria-pressed="false"[^>]*>1080p/.test(html), "an unlit quality can be added");
  });

  it("draws Status facts as shimmer while the channel is being built, keeping the rows", () => {
    for (const building of ["preparing", "starting", "restarting"] as const) {
      const html = status(live("a", { state: building }));
      assert.ok(html.includes(">State<") && html.includes(">Playlist<") && html.includes("animate-skel-shimmer"), building);
      assert.ok(!html.includes(`data-st="${building}"`) && !html.includes(">a.mp4<"), building);
    }
  });

  it("shows a failed channel's problem, the playlist with the video on air lit, and the address with copy", () => {
    const html = status(live("a", { state: "failed", problem: "The folder holds no video." }));
    assert.ok(at(html, 'data-st="failed"') < at(html, "The folder holds no video."));
    assert.ok(/aria-current="true"[^>]*text-accent-text[^>]*>.*?b\.mp4/.test(html), "the playing row is lit");
    assert.ok(html.includes(">00:42<") && html.includes(">01:01<"));
    assert.ok(html.includes('aria-label="Copy the address"') && html.includes('value="http://127.0.0.1:5172/live/a/master.m3u8"'));
  });
});
