import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { ChannelRows } from "@/components/channels/ChannelRows";
import { ChannelsIndex } from "@/components/channels/ChannelsIndex";
import { NewChannelRows } from "@/components/channels/NewChannelRows";
import { EMPTY_NEW_CHANNEL } from "@/lib/channel-body";
import { useAppStore } from "@/store/app-store";
import { live, stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const label = (html: string, text: string): number => html.indexOf(`<span class="truncate">${text}</span>`);
const rows = (draft = EMPTY_NEW_CHANNEL, chooseReason?: string) =>
  renderLive(
    createElement(NewChannelRows, {
      draft,
      errors: {},
      onChange: () => undefined,
      onKind: () => undefined,
      onEnter: () => undefined,
      chooseReason,
      onChoose: () => undefined,
    }),
  );
const NO_HOST = "Folders can be chosen only in the backend&#x27;s own window; type the path.";

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New channel form", () => {
  it("draws Name, Kind, Category, Folder in that order for a live channel, with no Number and no placeholder", () => {
    const html = rows();
    assert.ok(label(html, "Number") === -1);
    const order = ["Name", "Kind", "Category", "Folder"].map((text) => label(html, text));
    assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > (order[index - 1] ?? 0))), String(order));
    assert.ok(!html.includes("placeholder=") && label(html, "Stream address") === -1);
    assert.ok(html.includes('aria-label="Kind"') && html.includes(">Live</button>") && html.includes(">Stream</button>"));
    assert.ok(html.includes("<select") && html.includes(">Entertainment</option>"));
  });

  it("draws Stream address in place of Folder for a stream channel, and a free-text Category", () => {
    const html = rows({ ...EMPTY_NEW_CHANNEL, kind: "stream" });
    assert.ok(label(html, "Stream address") > label(html, "Category"));
    assert.ok(!html.includes("<select") && label(html, "Folder") === -1 && !html.includes("Choose"));
  });

  it("puts an info glyph on every row, Name included", () => {
    const html = rows();
    for (const text of ["Name", "Kind", "Category", "Folder"]) assert.ok(html.includes(`About ${text}`), text);
  });

  it("keeps Choose in place, disabled with its reason, without the backend's window; enabled with it", () => {
    assert.ok(rows(EMPTY_NEW_CHANNEL, NO_HOST.replace("&#x27;", "'")).includes(`aria-label="Choose. ${NO_HOST}"`));
    const enabled = rows(EMPTY_NEW_CHANNEL, undefined);
    assert.ok(/<button[^>]*>.*?Choose<\/button>/.test(enabled) && !enabled.includes("Choose. "));
  });

  it("disables Create with the first missing row's reason; in a browser Choose says why", () => {
    const html = renderLive(createElement(ChannelsIndex));
    assert.ok(html.includes('aria-label="Create. Name is required."'));
    assert.ok(html.includes(`aria-label="Choose. ${NO_HOST}"`));
    assert.ok(html.indexOf('role="toolbar"') > html.indexOf("New channel"), "no bar above the New group");
  });
});

describe("the channels table strip", () => {
  const table = () => {
    const html = renderLive(createElement(ChannelsIndex));
    return html.slice(html.indexOf('aria-label="Channels table"'));
  };

  it("draws Refresh first and Preview → rightmost, waiting for a ticked row; every bulk verb waits with its reason", () => {
    const html = table();
    assert.ok(html.includes('aria-label="Preview channel. Tick a row first"') && html.includes("Preview →"));
    assert.ok(html.indexOf("Refresh channels") < html.indexOf("Select all channels"));
    assert.ok(html.indexOf("Select all channels") < html.indexOf("Preview channel"));
    for (const verb of ["Enable", "Disable", "Rebuild", "Delete"]) assert.ok(html.includes(`aria-label="${verb}. Tick a row first"`), verb);
  });

  it("enables the bulk verbs once a row is ticked, with no count text and no Clear selection", () => {
    assert.ok(table().includes('title="Refresh channels"'));
    state().channelsLoaded([live("a")], 1);
    state().channelTick("a", true);
    const html = table();
    for (const verb of ["Enable", "Rebuild"]) assert.ok(html.includes(`${verb}</button>`), verb);
    assert.ok(!html.includes("Rebuild. ") && html.includes(">Delete</button>"));
    assert.ok(!html.includes("selected<") && !html.includes("Clear selection") && html.includes('aria-checked="true"'));
  });

  it("gates Preview on exactly one ticked row, live or stream", () => {
    state().channelsLoaded([live("a"), stream("b")], 1);
    state().channelTick("a", true);
    state().channelTick("b", true);
    assert.ok(table().includes('aria-label="Preview channel. Tick only one row"'));
    state().channelTick("a", false);
    assert.ok(/<button[^>]*aria-label="Preview channel"[^>]*>/.test(table()) && !table().includes("Preview channel. "));
  });

  it("enables only the verbs a ticked row can run, with the all-skipped reasons", () => {
    state().channelsLoaded([stream("b")], 1);
    state().channelTick("b", true);
    const html = table();
    assert.ok(html.includes('aria-label="Enable. Every ticked channel is already enabled."'));
    assert.ok(html.includes('aria-label="Rebuild. A stream channel has nothing to rebuild."'));
    assert.ok(html.includes("Disable</button>") && !html.includes("Disable. "));
  });
});

describe("the channels grid", () => {
  it("draws shimmer rows, never a sentence, before a read and while empty", () => {
    const html = renderLive(createElement(ChannelRows));
    assert.ok(html.includes('aria-hidden="true"') && !html.includes("Select Channel"));
    assert.ok(!html.includes("Select all"), "select-all is the toolbar's All, not a header tick");
  });

  it("draws the headings, the ticks, the state words, the dimmed disabled row and the synced Delete tip", () => {
    state().channelsLoaded(
      [
        live("b", { enabled: false }),
        live("a", { state: "preparing" }),
        stream("c", { source: "lists.example" }),
      ],
      1,
    );
    state().channelTick("a", true);
    const html = renderLive(createElement(ChannelRows));
    for (const heading of ["name", "category", "kind", "state", "mode", "now playing"]) {
      assert.ok(html.includes(`>${heading}</span>`), heading);
    }
    assert.ok(!html.includes(">number</span>"));
    assert.ok(html.indexOf("Select Channel a") < html.indexOf("Select Channel b"), "by name");
    assert.ok(html.includes('data-st="preparing"') && html.includes('data-st="disabled"') && html.includes('data-st="synced"'));
    assert.ok(/<li data-st="disabled"[^>]*opacity-45/.test(html));
    assert.ok(/<li data-st="preparing" data-ticked=""/.test(html));
    assert.ok(!html.includes(">fault</span>"));
    assert.ok(html.includes('title="The next sync adds it again. Disable it to keep it off."'));
    assert.ok(!html.includes("Select all") && html.includes('aria-checked="true"'));
  });

  it("disables every Delete with the unreachable sentence while the backend cannot be reached", () => {
    state().channelsLoaded([live("a")], 1);
    state().channelsMarkUnreachable(true);
    assert.ok(renderLive(createElement(ChannelRows)).includes('title="The admin backend cannot be reached."'));
  });
});
