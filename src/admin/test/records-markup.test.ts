import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Radio } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TabPage } from "@/components/chrome/TabPage";
import { IndexSkeleton } from "@/components/records/IndexSkeleton";
import { ListGroup } from "@/components/records/ListGroup";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
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
  it("draws its title, the action slot and the list, and no splitter after it", () => {
    const html = renderToStaticMarkup(
      createElement(ListGroup, {
        id: "ch-list",
        icon: Radio,
        title: "Channels",
        action: createElement("button", null, "Refresh"),
        children: "LIST",
      }),
    );
    assert.ok(html.includes(">Channels</h2>") && html.includes(">Refresh</button>") && html.includes("LIST"));
    assert.ok(!html.includes("<hr"));
    assert.ok(html.indexOf("Refresh") < html.indexOf("LIST"));
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

  it("shows the toolbar strip over the skeleton: Channels' forward verb waits for a ticked row", () => {
    const html = renderToStaticMarkup(createElement(ChannelsPage, { active: true }));
    assert.ok(html.indexOf('role="toolbar"') < html.indexOf("New channel"));
    assert.ok(html.includes('aria-label="Preview →. Tick a row first"'));
    assert.ok(html.includes("h-10"));
  });

  it("gives Providers a forward verb that works, and Accounts the bulk verbs, all waiting for a ticked account", () => {
    const providers = renderToStaticMarkup(createElement(ProvidersPage, { active: true }));
    assert.ok((providers.match(/<button[^>]*>Titles →/)?.[0] ?? "").length > 0);
    assert.ok(!(providers.match(/<button[^>]*>Titles →/)?.[0] ?? "").includes('disabled=""'));
    const accounts = renderToStaticMarkup(createElement(AccountsPage, { active: true }));
    const strip = accounts.slice(accounts.indexOf('role="toolbar"'), accounts.indexOf("New account"));
    for (const verb of ["Enable", "Disable"]) assert.ok(strip.includes(`aria-label="${verb}. Tick an account first"`), verb);
    assert.ok(strip.includes('title="Tick an account first"'), "Delete is an armed two-step, disabled with the same reason");
  });
});

describe("a workspace's pieces", () => {
  it("draws the toolbar with Discard and Save disabled while nothing has changed", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceToolbar, {
        label: "Channel toolbar",
        dirty: false,
        discard: { label: "Discard changes", onPress: NOTHING },
        save: { label: "Save", onPress: NOTHING },
        forward: { label: "Titles →", onPress: NOTHING },
      }),
    );
    assert.ok(html.includes(`aria-label="Discard changes. ${NOTHING_CHANGED}"`));
    assert.ok(html.includes(`aria-label="Save. ${NOTHING_CHANGED}"`));
    assert.ok(html.indexOf("Discard changes") < html.indexOf(">Save<") && html.indexOf(">Save<") < html.indexOf("Titles →"));
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
