import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { CatalogRows } from "@/components/jobs/CatalogRows";
import { JobScheduleGroup } from "@/components/jobs/JobScheduleGroup";
import { NewJobForm } from "@/components/jobs/NewJobForm";
import { createReason } from "@/lib/job-checks";
import { EMPTY_NEW_JOB } from "@/lib/job-draft";
import { JobsPage } from "@/pages/JobsPage";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { counts, catalogJob, playlist, playlistJob } from "./support/run-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob => playlistJob(id, 1, { name: `Job ${id}`, ...extra });
const catalog = (id: number, extra: Partial<AdminJob> = {}): AdminJob =>
  catalogJob(id, { name: `Job ${id}`, config: { scope: "popular", kind: "tv", pages: 5 }, ...extra });
const page = (): string => renderLive(createElement(JobsPage, { active: true }));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New job form", () => {
  it("makes catalog jobs with the same fields as edit: Name, Type, Scope, Kind, Pages, Enabled and Schedule", () => {
    const html = renderLive(createElement(NewJobForm));
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Type"'));
    assert.ok(at(html, 'aria-label="Type"') < at(html, 'aria-label="Scope"'));
    assert.ok(at(html, 'aria-label="Scope"') < at(html, 'aria-label="Kind"'));
    assert.ok(at(html, 'aria-label="Kind"') < at(html, 'aria-label="Pages"'));
    assert.ok(at(html, 'aria-label="Pages"') < at(html, 'aria-label="Enabled"'));
    assert.ok(at(html, 'aria-label="Enabled"') < at(html, 'aria-label="Interval"'));
    for (const gone of ['aria-label="Playlist"', ">Catalog</button>", 'placeholder="']) {
      assert.ok(!html.includes(gone), gone);
    }
    assert.match(html, /<input[^>]*readOnly=""[^>]*aria-label="Type"[^>]*value="Catalog"/);
    assert.ok(html.includes('<option value="all" selected="">All</option>'));
    assert.ok(html.includes('aria-checked="true"') && html.includes('<option value="off" selected="">Off</option>'));
    assert.ok(html.includes('aria-label="Create. Name is required."'));
  });

  it("gives the Create reason: the Name, then busy, then nothing", () => {
    assert.equal(createReason(EMPTY_NEW_JOB, undefined), "Name is required.");
    assert.equal(createReason({ ...EMPTY_NEW_JOB, name: "N" }, "Saving."), "Saving.");
    assert.equal(createReason({ ...EMPTY_NEW_JOB, name: "N" }, undefined), undefined);
  });

  it("offers every scope and All, Movies and Series from selects; Discover has no Kind or Pages", () => {
    const props = { scope: "trending", kind: "all", pages: "5", errors: {}, onChange: () => undefined } as const;
    const rows = renderLive(createElement(CatalogRows, props));
    assert.ok(at(rows, 'aria-label="Scope"') < at(rows, 'aria-label="Kind"'));
    for (const label of [">Trending<", ">Popular<", ">Discover<", ">All<", ">Movies<", ">Series<"]) {
      assert.ok(rows.includes(label), label);
    }
    const discover = renderLive(createElement(CatalogRows, { ...props, scope: "discover" }));
    assert.ok(!discover.includes('aria-label="Kind"') && !discover.includes('aria-label="Pages"'));
  });

  it("offers Recent, the Library update's scope, and hides its Kind", () => {
    const props = { scope: "trending", kind: "all", pages: "5", errors: {}, onChange: () => undefined } as const;
    assert.ok(renderLive(createElement(CatalogRows, props)).includes(">Recent<"));
    const recent = renderLive(createElement(CatalogRows, { ...props, scope: "recent" }));
    assert.ok(recent.includes('aria-label="Scope"') && !recent.includes('aria-label="Kind"'));
    assert.ok(!recent.includes('aria-label="Pages"'));
  });
});

describe("the jobs list", () => {
  it("draws shimmer rows before a read, then the headings, words, the running bar and a dimmed disabled job", () => {
    assert.ok(page().includes("animate-skel-shimmer"));
    state().jobsLoaded([
      job(1, { running: true }),
      job(2, { enabled: false, schedule: "off" }),
      catalog(3, { lastRunAt: 5, lastResult: "failed", lastCounts: { code: "tmdb.unavailable" } }),
    ]);
    const html = page();
    for (const heading of [">name<", ">type<", ">target<", ">schedule<", ">last run<", ">outcome<", ">state<"]) {
      assert.ok(html.includes(heading), heading);
    }
    assert.ok(html.includes('data-st="running"') && html.includes("animate-pulse-busy"));
    assert.ok(html.includes('data-st="disabled"') && html.includes("opacity-45") && html.includes('data-st="failed"'));
    assert.ok(html.includes(">popular series<") && html.includes(">List 1<") && html.includes(">never<"));
    assert.ok(html.includes("Failed: The title service cannot be reached right now."), "the outcome is worded from the typed result");
    assert.ok(html.includes(">Every day<") && html.includes(">Off<"), "the schedule column words");
  });

  it("disables a playlist job's row Delete, and a running catalog job's, each with its reason", () => {
    state().jobsLoaded([job(1), catalog(2, { running: true }), catalog(3)]);
    const html = page();
    assert.equal(html.split('title="A playlist&#x27;s job goes with the playlist."').length - 1, 1);
    assert.equal(html.split('title="A running job cannot be deleted."').length - 1, 1);
    assert.ok(html.includes('title="Deletes the job; what it synced stays."'), "a catalog job's Delete works");
  });

  it("draws Refresh, then Enable, Disable and the armed Delete last; Run job is the page toolbar's", () => {
    state().jobsLoaded([job(1)]);
    let html = page();
    const table = (): string => html.slice(html.indexOf('aria-label="Jobs table"'));
    const top = (): string => html.slice(0, html.indexOf("overflow-y-auto"));
    assert.ok(table().includes('title="Refresh jobs"') && !table().includes("Run job"), "run left the strip (`55` decision 6)");
    assert.ok(top().includes('aria-label="Run job. Tick a job first"'), "the promote waits in the page toolbar");
    state().jobTick(1, true);
    html = page();
    assert.ok(table().includes("Enable</button>") && !table().includes("Stop</button>"));
    assert.ok(at(table(), "Enable") < at(table(), "Disable") && at(table(), "Disable") < at(table(), ">Delete</button>"));
    assert.ok(/<button[^>]*title="Run the ticked rows now"[^>]*>Run job<\/button>/.test(top()), "ticked, the promote runs");
    assert.ok(table().includes('aria-label="Delete. A playlist&#x27;s job goes with the playlist."'), "bulk Delete of a playlist job");
  });

  it("disables the promote Run job with the gate's reason for a ticked job whose playlist is disabled", () => {
    state().jobsPlaylistsLoaded([playlist(1, { enabled: false })]);
    state().jobsLoaded([job(1)]);
    state().jobTick(1, true);
    const html = page();
    assert.ok(html.slice(0, html.indexOf("overflow-y-auto")).includes('aria-label="Run job. A ticked job&#x27;s playlist is disabled."'));
  });
});

describe("a job's workspace", () => {
  it("a playlist job: rail without Run, Details in order, the toolbar's Save and Run job, Last run from the typed counts", () => {
    const typed = counts({ created: 2, updated: 1, refused: 1, refusalExamples: ["Bad Entry"], source: "unchanged" });
    state().jobsPlaylistsLoaded([playlist(1)]);
    state().jobsLoaded([job(1, { lastRunAt: 5, lastResult: "ok", lastCounts: typed })]);
    state().openWorkspace("jobs", "1");
    const html = page();
    assert.ok(html.includes('aria-label="Job sections"'));
    for (const [a, b] of [[">Details<", ">Schedule<"], [">Schedule<", ">Last run<"]]) {
      assert.ok(at(html, a ?? "") < at(html, b ?? ""));
    }
    const rail = html.slice(at(html, 'aria-label="Job sections"'), at(html, 'role="toolbar"'));
    assert.ok(rail.includes(">Details<") && rail.includes(">Schedule<") && rail.includes(">Last run<"));
    assert.ok(!rail.includes(">Run<"), "the rail lists no Run section");
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Type"'));
    assert.ok(/aria-label="Name"[^>]*readOnly=""|readOnly=""[^>]*aria-label="Name"/.test(html), "a playlist job's name is derived");
    assert.ok(/<input[^>]*readOnly=""[^>]*aria-label="Playlist"[^>]*value="List 1"/.test(html), "the playlist is read-only");
    for (const gone of ['aria-label="Dry run"', 'aria-label="Prune"', "Dry run", "Prune"]) assert.ok(!html.includes(gone), gone);
    assert.ok(html.includes("Synced: 2 created, 1 updated, 1 refused."), "the outcome in words");
    assert.ok(html.includes("2 created · 1 updated · 0 skipped · 1 refused") && html.includes(">Web list unchanged<"));
    assert.ok(html.includes(">Bad Entry<") && !html.includes(">Created<"));
    const bar = html.slice(at(html, 'role="toolbar"'), at(html, 'id="jw-details"'));
    assert.ok(
      /<button[^>]*title="Start the job now[^>]*>Run job<\/button>/.test(bar),
      "an enabled playlist job runs from the toolbar",
    );
    assert.ok(bar.includes("text-accent-ink") && bar.includes("h-ctl-sm"), "Run job is the toolbar's small primary");
    assert.ok(
      bar.indexOf("Discard changes") < bar.indexOf("min-w-0 flex-1") &&
        bar.indexOf("min-w-0 flex-1") < bar.indexOf(">Save<") &&
        bar.indexOf(">Save<") < bar.indexOf(">Run job<"),
      "Discard left; Save, then Run job rightmost",
    );
    assert.ok(!bar.includes("Stop"), "Stop is the statusbar's, never the toolbar's");
    assert.ok(!bar.includes("→"), "no forward verb: Run job is the promote");
    assert.ok(html.includes('aria-label="Save. Nothing has changed."'), "the commit is the toolbar's Save");
    assert.ok(!html.includes("Save details"), "no trailing save on the form");
    assert.ok(html.includes('aria-label="Refresh last run"'), "Refresh is an icon on the State row");
  });

  it("a catalog job: Scope, Kind and Pages, Titles and a shimmer Stale, no forward verb", () => {
    state().jobsLoaded([catalog(4, { lastRunAt: 5, lastResult: "ok", lastCounts: { titles: 1240, stale: 3 } })]);
    state().openWorkspace("jobs", "4");
    const html = page();
    assert.ok(html.includes('aria-label="Scope"') && html.includes('aria-label="Pages"'));
    assert.ok(!html.includes('aria-label="Playlist"'));
    assert.ok(html.includes(">1240<") && html.includes(">3<") && html.includes("Synced: 1,240 titles, 3 stale."));
    assert.ok(!html.includes("→"), "the forward verbs are gone; Run job is the promote");
    assert.ok(html.split("text-accent-ink").length <= 3, "the primaries are Run job and Save");
  });

  it("keeps the toolbar's Run job enabled for a disabled job, and shows a bad interval under its row", () => {
    state().jobsLoaded([job(1, { enabled: false })]);
    state().openWorkspace("jobs", "1");
    const workspace = page();
    assert.ok(workspace.includes('title="Start the job now'), "the job's switch gates only its schedule");
    assert.ok(!workspace.includes("Jobs that are disabled cannot run."));
    const sentence = "Interval is a number and s, m or h, like 30m or 6h, or off.";
    const props = { value: "x", job: job(1), error: sentence, onChange: () => undefined };
    const html = renderLive(createElement(JobScheduleGroup, props));
    assert.ok(html.includes('role="alert"') && html.includes(sentence) && html.includes('aria-invalid="true"'));
  });
});
