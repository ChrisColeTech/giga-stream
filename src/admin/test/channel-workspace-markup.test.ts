import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { LiveDetailsGroup } from "@/components/channels/LiveDetailsGroup";
import { LiveStatusGroup } from "@/components/channels/LiveStatusGroup";
import { PlaybackGroup } from "@/components/channels/PlaybackGroup";
import { PlaylistRows } from "@/components/channels/PlaylistRows";
import { liveDraft } from "@/lib/channel-draft";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { useAppStore } from "@/store/app-store";
import type { LiveAdminChannel } from "@/types/admin-channel";
import { holdChannels } from "./support/channels-hold";
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
  it("opens from the held list: the rail, the page toolbar (Discard; Save, Preview →), the groups and no trailing save", () => {
    holdChannels([live("a")], 1);
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
    assert.ok(html.includes('aria-label="Save. Nothing has changed."'));
    assert.ok(!html.includes("Save details"), "the trailing save is gone (`55` decision 1)");
    const bar = html.slice(at(html, 'role="toolbar"'), html.indexOf("overflow-y-auto", at(html, 'role="toolbar"')));
    assert.ok(
      bar.indexOf("Discard changes") < bar.indexOf("min-w-0 flex-1") &&
        bar.indexOf("min-w-0 flex-1") < bar.indexOf(">Save<") &&
        bar.indexOf(">Save<") < bar.indexOf("Preview →"),
      "Discard left; Save, then the forward verb rightmost",
    );
    assert.ok(/<button[^>]*title="Preview channel"[^>]*>Preview →<\/button>/.test(bar), "a saved channel previews");
    assert.ok(!status(live("a")).includes("Preview"), "the Status group no longer carries Preview");
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

  it("switches Plays to the ordered Videos table in place of the Folder row: #, path, the end actions", () => {
    const html = details(live("a"), { plays: "videos", videos: ["D:\\x.mp4", "D:\\y.mp4"] });
    assert.ok(html.includes('aria-label="Videos"') && html.includes('aria-label="Move D:\\x.mp4 up. Already first"'));
    assert.ok(!html.includes('aria-label="Folder"'));
    const table = html.slice(html.indexOf(">Videos<"), html.indexOf('aria-label="Video to add"'));
    assert.ok(table.indexOf(">#<") < table.indexOf(">path<"), "the number column first, then the path");
    assert.ok(!table.includes('type="checkbox"') && !table.includes("aria-sort=") && !table.includes("Sort by"));
    assert.ok(!table.includes("data-primary"), "no record to open, no spanning button (`52` decision 6)");
    assert.ok(table.indexOf('data-col="path"') < table.indexOf('aria-label="Remove'), "the verbs live in the end cell, after the path");
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
      createElement(PlaybackGroup, { draft: liveDraft(live("a")), onChange: () => undefined }),
    );
    assert.ok(!html.includes("Save details"), "the group ends without a commit; the toolbar holds the Save");
    assert.ok(html.includes('aria-label="Mode"') && html.includes(">Encode</button>") && html.includes('aria-label="Captions"'));
    const reason = "A channel keeps at least two qualities.";
    const lockedReasons = (html.match(/<span[^>]*>/g) ?? []).filter((tag) => tag.includes(`. ${reason}"`));
    assert.equal(lockedReasons.length, 2, "both locked qualities expose their reason on focusable tooltip wrappers");
    assert.ok(lockedReasons.some((tag) => tag.includes(`aria-label="360p. ${reason}"`)));
    assert.ok(lockedReasons.some((tag) => tag.includes(`aria-label="720p. ${reason}"`)));
    assert.ok(
      lockedReasons.every(
        (tag) => tag.includes("aria-describedby=") && tag.includes('role="group"') && tag.includes('tabindex="0"'),
      ),
      "each reason wrapper is described and keyboard focusable",
    );
    assert.ok(!html.includes(`title="${reason}"`), "the reason is not title-only");
    assert.ok(/aria-pressed="false"[^>]*>1080p/.test(html), "an unlit quality can be added");
  });

  it("draws Status facts as shimmer while the channel is being built, keeping the rows", () => {
    for (const building of ["preparing", "starting", "restarting"] as const) {
      const html = status(live("a", { state: building }));
      assert.ok(html.includes(">State<") && html.includes(">Playlist<") && html.includes("animate-skel-shimmer"), building);
      assert.equal(
        (html.match(/aria-hidden="true" class="pointer-events-none/g) ?? []).length,
        6,
        `the standard skeleton rows in the table's own columns while ${building}`,
      );
      assert.ok(!html.includes(`data-st="${building}"`) && !html.includes(">a.mp4<"), building);
    }
  });

  it("draws the playlist as the standard table: #, name, duration under their words, no ticks, nothing sortable", () => {
    const html = status(live("a"));
    const table = html.slice(at(html, ">Playlist<"), at(html, ">Stream address<"));
    assert.ok(table.indexOf(">#<") < table.indexOf(">name<") && table.indexOf(">name<") < table.indexOf(">duration<"));
    assert.ok(!table.includes('type="checkbox"') && !table.includes('aria-label="Select'), "no selection anywhere (`52` decision 5)");
    assert.ok(!table.includes("aria-sort=") && !table.includes("Sort by"), "nothing sorts: play order is the order");
    assert.ok(!table.includes("data-primary"), "a read-only list opens nothing");
    assert.ok(table.includes(">1</span>") && table.includes(">2</span>"));
    assert.ok(table.includes(">a.mp4<") && table.includes(">b.mp4<") && table.includes(">00:42<") && table.includes(">01:01<"));
  });

  it("windows the playlist above 100 entries, and maps every entry at or under 100 (`52` decision 4)", () => {
    const many = Array.from({ length: 200 }, (_, index) => ({ name: `v${index}.mp4`, durationMs: 42_000 }));
    const long = renderLive(createElement(PlaylistRows, { playlist: many, playing: null }));
    const mounted = long.split("data-index=").length - 1;
    assert.ok(long.includes('aria-rowcount="200"'));
    assert.ok(mounted > 0 && mounted <= 30, String(mounted));
    const short = renderLive(createElement(PlaylistRows, { playlist: many.slice(0, 10), playing: 2 }));
    assert.equal(short.split("data-index=").length - 1, 10);
    assert.ok(short.includes(">v9.mp4<"));
  });

  it("shows a failed channel's problem, the playlist with the video on air lit, and the address with copy", () => {
    const html = status(live("a", { state: "failed", problem: "The folder holds no video." }));
    assert.ok(at(html, 'data-st="failed"') < at(html, "The folder holds no video."));
    /* `text-accent-text` cannot be searched for alone: it also appears inside every IconButton's `data-on:` variant
     * classes (the Status group's Refresh status button sits before the playlist), so the accent is pinned inside
     * the playing row itself. */
    const onAir = at(html, 'data-st="playing"');
    const row = html.slice(onAir, html.indexOf("</li>", onAir) + 5);
    assert.ok(
      row.includes('data-col="name"') && row.indexOf("text-accent-text") >= 0 &&
        row.indexOf("text-accent-text") < row.indexOf(">b.mp4<"),
      "the on-air row's state is the marker and its name draws in the accent",
    );
    assert.ok(!html.includes("aria-current"), "the kit's row has no such slot (`52` decision 2)");
    assert.ok(html.includes(">00:42<") && html.includes(">01:01<"));
    assert.ok(html.includes('aria-label="Copy the address"') && html.includes('value="http://127.0.0.1:5172/live/a/master.m3u8"'));
  });
});
