import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { StreamAddressGroup } from "@/components/channels/StreamAddressGroup";
import { StreamDetailsGroup } from "@/components/channels/StreamDetailsGroup";
import { StreamStatusGroup } from "@/components/channels/StreamStatusGroup";
import { streamDraft } from "@/lib/channel-draft";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { useAppStore } from "@/store/app-store";
import type { StreamAdminChannel } from "@/types/admin-channel";
import { holdChannels } from "./support/channels-hold";
import { stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const page = (): string => renderLive(createElement(ChannelsPage, { active: true }));
const details = (channel: StreamAdminChannel) =>
  renderLive(
    createElement(StreamDetailsGroup, { channel, draft: streamDraft(channel), errors: {}, onChange: () => undefined }),
  );
const statusGroup = (channel: StreamAdminChannel, revertReason?: string) =>
  renderLive(
    createElement(StreamStatusGroup, {
      channel,
      revertReason,
      onRevert: () => undefined,
    }),
  );
const SAVE = { onPress: () => undefined, reason: "Nothing has changed." };
const SYNCED = stream("s", { source: "lists.example", editedFields: ["name", "streamUrl"] });

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("a stream channel's workspace", () => {
  it("opens with the rail Details, Stream, Status, the page toolbar (Discard, Preview →) and Save details ending Stream", () => {
    holdChannels([stream("s")], 1);
    state().openWorkspace("channels", "s");
    const html = page();
    assert.ok(html.indexOf(">Details<") < html.indexOf(">Stream<") && html.indexOf(">Stream<") < html.indexOf(">Status<"));
    assert.ok(!html.includes(">Playback<"));
    assert.ok(html.includes('aria-label="Save details. Nothing has changed."'));
    assert.ok(html.includes('aria-label="Discard changes. Nothing has changed."'));
    const start = html.indexOf('role="toolbar"');
    const bar = html.slice(start, html.indexOf("overflow-y-auto", start));
    assert.ok(/<button[^>]*title="Preview channel"[^>]*>Preview →<\/button>/.test(bar), "Preview → is the page toolbar's");
    assert.ok(!statusGroup(stream("s")).includes("Preview") && !html.includes(">Save<"));
    assert.ok(html.indexOf("Save details") > html.indexOf(">Stream<"), "the commit ends the Stream group");
    assert.ok(html.includes(">Added by hand<") && html.includes('value="Stream"'));
  });

  it("draws Details in order: Name, Kind, Category, Enabled", () => {
    const html = details(stream("s"));
    const order = ["Name", "Kind", "Category", "Enabled"].map((label) => html.indexOf(`<span class="truncate">${label}</span>`));
    assert.ok(order.every((value, index) => value >= 0 && (index === 0 || value > (order[index - 1] ?? 0))), String(order));
  });

  it("tags a synced row's edited fields `Edited`, and says the next sync keeps them", () => {
    const html = details(SYNCED);
    assert.equal((html.match(/>Edited</g) ?? []).length, 1, "the name, in Details");
    assert.ok(html.includes("About Name"), "the edited Name's glyph carries the tip that the next sync keeps it");
    assert.ok(details(stream("s")).includes("About Name"), "an unedited Name has its glyph too");
    const address = renderLive(
      createElement(StreamAddressGroup, {
        draft: streamDraft(SYNCED),
        errors: {},
        edited: SYNCED.editedFields ?? [],
        onChange: () => undefined,
        save: SAVE,
      }),
    );
    assert.equal((address.match(/>Edited</g) ?? []).length, 1, "the stream address, in Stream");
  });

  it("gives Revert to playlist its reason, or lets it run on a synced row with edits; it is an icon, not in a heading", () => {
    const handMade = "This channel was made by hand; there is nothing to revert.";
    assert.ok(statusGroup(stream("s"), handMade).includes(`aria-label="Revert to playlist. ${handMade}"`));
    assert.ok(/<button[^>]*aria-label="Revert to playlist"[^>]*title="Revert to playlist"/.test(statusGroup(SYNCED)));
    assert.ok(!details(SYNCED).includes("Revert to playlist"));
  });

  it("puts a refused address under its row with aria-invalid", () => {
    const html = renderLive(
      createElement(StreamAddressGroup, {
        draft: { ...streamDraft(stream("s")), streamUrl: "http://plain" },
        errors: { streamUrl: "Stream address must be an https address." },
        edited: [],
        onChange: () => undefined,
        save: SAVE,
      }),
    );
    assert.ok(html.includes('role="alert">Stream address must be an https address.</p>'));
    assert.ok(/aria-label="Stream address" aria-invalid="true"/.test(html));
  });

  it("names where a synced row came from", () => {
    holdChannels([SYNCED], 1);
    state().openWorkspace("channels", "s");
    assert.ok(page().includes(">Synced from lists.example<"));
  });
});
