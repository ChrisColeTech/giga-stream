import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Radio } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TabPage } from "@/components/chrome/TabPage";
import { DiscardBar } from "@/components/records/DiscardBar";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { SaveDetails } from "@/components/records/SaveDetails";
import { ListGroup } from "@/components/records/ListGroup";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { RecordRail } from "@/components/records/RecordRail";
import { PreviewButton } from "@/components/channels/PreviewButton";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NOTHING_CHANGED } from "@/constants/record-copy";
import { TAB_ORDER } from "@/constants/tabs";
import { AccountsPage } from "@/pages/AccountsPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { ProvidersPage } from "@/pages/ProvidersPage";

const NOTHING = (): void => undefined;
const count = (html: string, needle: string) => html.split(needle).length - 1;
const text = (html: string): string => html.replace(/<[^>]+>/g, "");

describe("the New <record> frame", () => {
  it("draws the tile, the mono title and the fold, with its rows", () => {
    const html = renderToStaticMarkup(
      createElement(NewRecordGroup, { id: "ch-create", icon: Radio, title: "New channel", children: "ROWS" }),
    );
    assert.ok(html.includes('id="ch-create"') && html.includes("<h2") && html.includes(">New channel</h2>"));
    assert.ok(html.includes("aria-expanded") && html.includes("ROWS"));
    assert.ok(html.includes("<hr"), "the group draws the splitter after itself");
    assert.ok(!html.includes("Create"), "no Create while the form has no fields");
  });

  it("ends in one primary Create, disabled with the missing field's reason", () => {
    const create = { onPress: NOTHING, reason: "Name is required." };
    const html = renderToStaticMarkup(
      createElement(NewRecordGroup, { id: "x", icon: Radio, title: "New channel", create, children: "ROWS" }),
    );
    assert.ok(html.includes('aria-label="Create. Name is required."'));
    assert.ok((html.match(/<button[^>]*>Create/)?.[0] ?? "").includes('disabled=""'));
    assert.ok(html.indexOf("ROWS") < html.indexOf(">Create<"));
    assert.equal(count(html, "Create<"), 1);
  });

  it("is an ordinary enabled primary button once the form can be created", () => {
    const html = renderToStaticMarkup(
      createElement(NewRecordGroup, {
        id: "x",
        icon: Radio,
        title: "New channel",
        create: { onPress: NOTHING },
        children: "ROWS",
      }),
    );
    assert.ok(!html.includes('role="group"') && !(html.match(/<button[^>]*>Create/)?.[0] ?? "").includes('disabled=""'));
  });
});

describe("the list frame", () => {
  it("draws its title, the table strip and the list, and no splitter after it", () => {
    const html = renderToStaticMarkup(
      createElement(ListGroup, {
        id: "ch-list",
        icon: Radio,
        title: "Channels",
        strip: createElement("div", { role: "toolbar" }, "STRIP"),
        children: "LIST",
      }),
    );
    assert.ok(html.includes(">Channels</h2>") && html.includes("STRIP") && html.includes("LIST"));
    assert.ok(!html.includes("<hr"));
    assert.ok(html.indexOf("STRIP") < html.indexOf("LIST"));
  });

  it("carries no button in its heading: only the fold, before the strip", () => {
    const html = renderToStaticMarkup(
      createElement(ListGroup, {
        id: "ch-list",
        icon: Radio,
        title: "Channels",
        strip: createElement("button", { type: "button" }, "STRIPVERB"),
        children: "LIST",
      }),
    );
    const heading = html.slice(0, html.indexOf("STRIPVERB"));
    const names = (heading.match(/<button[^>]*>/g) ?? []).map((button) => button.match(/aria-label="([^"]*)"/)?.[1] ?? "");
    assert.ok(names.every((name) => name === "" || name.startsWith("Collapse") || name.startsWith("Expand")), names.join());
  });
});

describe("an index before its data", () => {
  it("wears shimmer rows in the New form's footprint and six list rows, for every tab", () => {
    for (const tab of TAB_ORDER) {
      const frame = INDEX_FRAMES[tab];
      const html = renderToStaticMarkup(createElement(IndexSkeleton, { frame }));
      assert.equal(count(html, "h-9 min-w-0 flex-1 rounded-ctl"), frame.newRows, `${tab} form rows`);
      assert.equal(count(html, "flex h-9 items-center gap-4 px-3"), 6, `${tab} list rows`);
      assert.ok(html.includes("animate-skel-shimmer"));
    }
  });

  it("says nothing over a skeleton: only the two group titles are text, and there is no placeholder", () => {
    for (const tab of TAB_ORDER) {
      const frame = INDEX_FRAMES[tab];
      const html = renderToStaticMarkup(createElement(IndexSkeleton, { frame }));
      assert.equal(text(html), `${frame.newTitle}${frame.listTitle}`, tab);
      assert.ok(!html.includes("placeholder") && !html.includes("aria-disabled"));
    }
  });

  it("prefixes each group's id with its tab, so two groups never fold together", () => {
    const html = renderToStaticMarkup(createElement(IndexSkeleton, { frame: INDEX_FRAMES.titles }));
    assert.ok(html.includes('id="titles-create"') && html.includes('id="titles-list"'));
  });
});

describe("a tab's page", () => {
  it("is mounted and visible when active, mounted and hidden when not", () => {
    const shown = renderToStaticMarkup(createElement(TabPage, { active: true, label: "Jobs", children: "BODY" }));
    const hidden = renderToStaticMarkup(createElement(TabPage, { active: false, label: "Jobs", children: "BODY" }));
    assert.ok(shown.includes("BODY") && !shown.includes("hidden"));
    assert.ok(hidden.includes("BODY") && hidden.includes("hidden"));
  });

  it("draws no page toolbar: the first thing under the titlebar is the New group, not a bar", () => {
    for (const page of [ChannelsPage, ProvidersPage, AccountsPage]) {
      const html = renderToStaticMarkup(createElement(page, { active: true }));
      assert.ok(html.indexOf('role="toolbar"') > html.indexOf("New "), "the only toolbar is the table strip, after the form");
      assert.ok(!html.includes("h-10 flex-none"), "no 40px bar");
    }
  });

  it("puts Channels' Preview in the table strip, waiting for a ticked row", () => {
    const html = renderToStaticMarkup(createElement(ChannelsPage, { active: true }));
    const table = html.slice(html.indexOf('aria-label="Channels table"'));
    assert.ok(table.includes('aria-label="Preview channel. Tick a row first"'));
  });

  it("puts Providers' Go to Titles in its table strip, working; Accounts' strip holds Refresh only", () => {
    const providers = renderToStaticMarkup(createElement(ProvidersPage, { active: true }));
    const table0 = providers.slice(providers.indexOf('aria-label="Providers table"'));
    const arrow = table0.match(/<button[^>]*aria-label="Go to Titles"[^>]*>/)?.[0] ?? "";
    assert.ok(arrow.length > 0 && !arrow.includes('disabled=""'));
    const accounts = renderToStaticMarkup(createElement(AccountsPage, { active: true }));
    assert.ok(!accounts.includes("Go to"), "Accounts has no forward verb");
    const table = accounts.slice(accounts.indexOf('aria-label="Accounts table"'));
    assert.ok(table.includes('aria-label="Refresh accounts"'), "Refresh is the strip's, always there");
    for (const verb of ["Enable", "Disable"]) assert.ok(!table.includes(`aria-label="${verb}`), `${verb} waits for a ticked row`);
  });
});

describe("a workspace's pieces", () => {
  it("draws Preview channel as an icon button with its tooltip, and the reason when the draft differs", () => {
    const html = renderToStaticMarkup(createElement(PreviewButton, { preview: { label: "Preview", onPress: NOTHING } }));
    assert.ok(/<button[^>]*aria-label="Preview channel"[^>]*title="Preview channel"/.test(html));
    assert.ok(!/>[^<]+<\/button>/.test(html), "icon only");
    const held = renderToStaticMarkup(
      createElement(PreviewButton, { preview: { label: "Preview", onPress: NOTHING, reason: "Save the channel first" } }),
    );
    assert.ok(held.includes("Save the channel first") && held.includes('disabled=""'));
  });

  it("draws Discard changes as the form's pinned ghost verb and Save details as its one primary, both with the reason", () => {
    const bar = renderToStaticMarkup(createElement(DiscardBar, { dirty: false, onDiscard: NOTHING }));
    assert.ok(bar.includes(`aria-label="Discard changes. ${NOTHING_CHANGED}"`) && bar.includes("border-b border-hair"));
    assert.ok(!bar.includes("text-accent-ink"), "Discard is ghost");
    const dirty = renderToStaticMarkup(createElement(DiscardBar, { dirty: true, onDiscard: NOTHING }));
    assert.ok(!dirty.includes("disabled=\"\""));
    const save = renderToStaticMarkup(createElement(SaveDetails, { save: { onPress: NOTHING, reason: NOTHING_CHANGED } }));
    assert.ok(save.includes(`aria-label="Save details. ${NOTHING_CHANGED}"`) && save.includes("text-accent-ink"));
    assert.ok(renderToStaticMarkup(createElement(SaveDetails, { save: { onPress: NOTHING } })).includes(">Save details</button>"));
  });

  it("draws the rail: the way back named for the tab, then the sections, the lit one selected", () => {
    const spy = { container: { current: null }, active: "playback", goTo: NOTHING, bind: () => () => undefined };
    const sections = [{ id: "details", label: "Details" }, { id: "playback", label: "Playback" }];
    const html = renderToStaticMarkup(createElement(RecordRail, { ariaLabel: "Channel sections", back: { label: "Channels", onPress: NOTHING }, sections, spy }));
    assert.ok(html.indexOf("Channels") < html.indexOf("Details") && html.indexOf("Details") < html.indexOf("Playback"));
    assert.ok(html.includes('aria-label="Channel sections"'));
    const selected = html.match(/<button[^>]*data-selected=""[^>]*>[^<]*<span[^>]*>([^<]*)/);
    assert.equal(selected?.[1], "Playback");
    assert.equal(count(html, 'aria-current="page"'), 1);
  });
});
