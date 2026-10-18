import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { StreamAddressGroup } from "@/components/channels/StreamAddressGroup";
import { StreamDetailsGroup } from "@/components/channels/StreamDetailsGroup";
import { streamDraft } from "@/lib/channel-draft";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { useAppStore } from "@/store/app-store";
import type { StreamAdminChannel } from "@/types/admin-channel";
import { stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const page = (): string => renderLive(createElement(ChannelsPage, { active: true }));
const details = (channel: StreamAdminChannel, revertReason?: string) =>
  renderLive(
    createElement(StreamDetailsGroup, {
      channel,
      draft: streamDraft(channel),
      errors: {},
      onChange: () => undefined,
      revertReason,
      onRevert: () => undefined,
    }),
  );
const SYNCED = stream("s", { source: "lists.example", editedFields: ["name", "streamUrl"] });

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("a stream channel's workspace", () => {
  it("opens with the rail Details, Stream, Status and the strip Discard, Save, Preview →", () => {
    state().channelsLoaded([stream("s")], 1);
    state().openWorkspace("channels", "s");
    const html = page();
    assert.ok(html.indexOf(">Details<") < html.indexOf(">Stream<") && html.indexOf(">Stream<") < html.indexOf(">Status<"));
    assert.ok(!html.includes(">Playback<") && !html.includes(">Fault<"));
    assert.ok(html.includes('aria-label="Save. Nothing has changed."') && /<button[^>]*>Preview →<\/button>/.test(html));
    assert.ok(html.includes(">Added by hand<") && html.includes('value="Stream"'));
  });

  it("draws Details in order: Name, Kind, Number, Category, Enabled", () => {
    const html = details(stream("s"));
    const order = ["Name", "Kind", "Number", "Category", "Enabled"].map((label) => html.indexOf(`<span class="truncate">${label}</span>`));
    assert.ok(order.every((value, index) => value >= 0 && (index === 0 || value > (order[index - 1] ?? 0))), String(order));
  });

  it("tags a synced row's edited fields `Edited`, and says the next sync keeps them", () => {
    const html = details(SYNCED);
    assert.equal((html.match(/>Edited</g) ?? []).length, 1, "the name, in Details");
    assert.ok(html.includes("About Name"), "the edited Name gains the glyph whose tip says the next sync keeps it");
    assert.ok(!details(stream("s")).includes("About Name"));
    const address = renderLive(
      createElement(StreamAddressGroup, { draft: streamDraft(SYNCED), errors: {}, edited: SYNCED.editedFields ?? [], onChange: () => undefined }),
    );
    assert.equal((address.match(/>Edited</g) ?? []).length, 1, "the stream address, in Stream");
  });

  it("gives Revert to playlist its reason, or lets it run on a synced row with edits", () => {
    const handMade = "This channel was made by hand; there is nothing to revert.";
    assert.ok(details(stream("s"), handMade).includes(`aria-label="Revert to playlist. ${handMade}"`));
    assert.ok(/<button[^>]*>.*?Revert to playlist<\/button>/.test(details(SYNCED)));
  });

  it("puts a refused address under its row with aria-invalid", () => {
    const html = renderLive(
      createElement(StreamAddressGroup, {
        draft: { ...streamDraft(stream("s")), streamUrl: "http://plain" },
        errors: { streamUrl: "Stream address must be an https address." },
        edited: [],
        onChange: () => undefined,
      }),
    );
    assert.ok(html.includes('role="alert">Stream address must be an https address.</p>'));
    assert.ok(/aria-label="Stream address" aria-invalid="true"/.test(html));
  });

  it("names where a synced row came from", () => {
    state().channelsLoaded([SYNCED], 1);
    state().openWorkspace("channels", "s");
    assert.ok(page().includes(">Synced from lists.example<"));
  });
});
