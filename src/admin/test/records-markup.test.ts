import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Radio } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TabPage } from "@/components/chrome/TabPage";
import { ForwardButton } from "@/components/records/ForwardButton";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { ListGroup } from "@/components/records/ListGroup";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { RecordRail } from "@/components/records/RecordRail";
import { DISCARD_TIP, WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NOTHING_CHANGED, SAVE_TIP } from "@/constants/record-copy";
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

  it("opens every index with the page toolbar, above the scrolling column and the New group", () => {
    for (const page of [ChannelsPage, ProvidersPage, AccountsPage]) {
      const html = renderToStaticMarkup(createElement(page, { active: true }));
      const bar = html.indexOf('role="toolbar"');
      assert.ok(bar >= 0 && bar < html.indexOf("overflow-y-auto") && bar < html.indexOf("New "), "the toolbar comes first");
      assert.ok(html.slice(0, bar + 200).includes("bg-panel"), "the toolbar is LoRA's, on the panel");
    }
  });

  it("puts Channels' Preview → in the page toolbar, the small primary, waiting for a ticked row", () => {
    const html = renderToStaticMarkup(createElement(ChannelsPage, { active: true }));
    const page = html.slice(0, html.indexOf("overflow-y-auto"));
    assert.ok(page.includes('aria-label="Preview →. Tick a row first"') && page.includes("text-accent-ink"));
    assert.ok(!html.slice(html.indexOf('aria-label="Channels table"')).includes("→"), "no forward verb in the list row");
  });

  it("puts Providers' Titles → in its page toolbar, working; Accounts' toolbar is empty", () => {
    const providers = renderToStaticMarkup(createElement(ProvidersPage, { active: true }));
    const top = providers.slice(0, providers.indexOf("overflow-y-auto"));
    const arrow = top.match(/<button[^>]*title="Go to Titles"[^>]*>Titles →<\/button>/)?.[0] ?? "";
    assert.ok(arrow.length > 0 && !arrow.includes('disabled=""') && arrow.includes("h-ctl-sm"));
    const accounts = renderToStaticMarkup(createElement(AccountsPage, { active: true }));
    const bar = accounts.slice(accounts.indexOf('role="toolbar"'), accounts.indexOf("overflow-y-auto"));
    assert.ok(bar.length > 0 && !bar.includes("<button"), "Accounts' page toolbar is drawn, empty");
    const table = accounts.slice(accounts.indexOf('aria-label="Accounts table"'));
    assert.ok(table.includes('title="Refresh accounts"'), "Refresh is the strip's, always there");
    for (const verb of ["Enable", "Disable"]) assert.ok(table.includes(`aria-label="${verb}. Tick `), `${verb} waits, drawn`);
  });
});

describe("a workspace's pieces", () => {
  it("draws the forward verb as the small primary, its word and arrow, its tooltip, and the reason when it waits", () => {
    const html = renderToStaticMarkup(createElement(ForwardButton, { verb: { label: "Preview", onPress: NOTHING } }));
    assert.ok(/<button[^>]*title="Preview channel"[^>]*>Preview →<\/button>/.test(html));
    assert.ok(html.includes("h-ctl-sm") && html.includes("text-accent-ink") && !html.includes("<svg"));
    const held = renderToStaticMarkup(
      createElement(ForwardButton, { verb: { label: "Preview", onPress: NOTHING, reason: "Save the channel first" } }),
    );
    assert.ok(held.includes("Save the channel first") && held.includes('disabled=""'));
  });

  it("draws the workspace toolbar: Discard changes left; Save, then the forward verb rightmost (`55` decision 1)", () => {
    const forward = { label: "Jobs" as const, onPress: NOTHING };
    const save = { onPress: NOTHING, reason: NOTHING_CHANGED };
    const bar = renderToStaticMarkup(
      createElement(WorkspaceToolbar, { dirty: false, onDiscard: NOTHING, save, forward }),
    );
    assert.ok(bar.startsWith('<div class="flex flex-none') && bar.includes('role="toolbar"') && bar.includes("bg-panel"));
    assert.ok(bar.includes(`aria-label="Discard changes. ${NOTHING_CHANGED}"`) && bar.includes("bg-transparent"));
    assert.ok(bar.includes(`aria-label="Save. ${NOTHING_CHANGED}"`) && bar.includes("text-accent-ink") && bar.includes("h-ctl-sm"));
    assert.ok(bar.indexOf("Discard changes") < bar.indexOf("min-w-0 flex-1"), "Discard left");
    assert.ok(
      bar.indexOf("min-w-0 flex-1") < bar.indexOf(">Save<") && bar.indexOf(">Save<") < bar.indexOf("Jobs →"),
      "Save, then the forward verb rightmost",
    );
    const dirty = renderToStaticMarkup(
      createElement(WorkspaceToolbar, { dirty: true, onDiscard: NOTHING, save: { onPress: NOTHING }, forward }),
    );
    assert.ok(!dirty.includes('disabled=""') && dirty.includes(`title="${SAVE_TIP}"`) && dirty.includes(`title="${DISCARD_TIP}"`));
  });

  it("draws the page's promote (`Run job`) in the forward verb's look, rightmost, disabled with its reason", () => {
    const promote = { label: "Run job", tip: "Start the job now.", onPress: NOTHING };
    const bar = renderToStaticMarkup(
      createElement(WorkspaceToolbar, { dirty: true, onDiscard: NOTHING, save: { onPress: NOTHING }, promote }),
    );
    assert.ok(/<button[^>]*title="Start the job now\."[^>]*>Run job<\/button>/.test(bar));
    assert.ok(bar.includes("text-accent-ink") && bar.includes("h-ctl-sm") && !bar.includes("<svg"));
    assert.ok(bar.indexOf(">Run job<") > bar.indexOf(">Save<") && !bar.includes("→"), "the promote is rightmost, no arrow");
    const held = renderToStaticMarkup(
      createElement(WorkspaceToolbar, {
        dirty: true,
        onDiscard: NOTHING,
        promote: { label: "Run job", tip: "Start the job now.", reason: "Save the job first", onPress: NOTHING },
      }),
    );
    assert.ok(held.includes('aria-label="Run job. Save the job first"') && held.includes('disabled=""'));
    const plain = renderToStaticMarkup(createElement(WorkspaceToolbar, { dirty: false, onDiscard: NOTHING }));
    assert.ok(!plain.includes("Run job") && !plain.includes(">Save<"), "both slots are optional");
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
