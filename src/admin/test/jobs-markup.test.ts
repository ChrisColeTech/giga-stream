import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { CatalogRows } from "@/components/jobs/CatalogRows";
import { JobScheduleGroup } from "@/components/jobs/JobScheduleGroup";
import { JobDetailsGroup } from "@/components/jobs/JobDetailsGroup";
import { NewJobForm } from "@/components/jobs/NewJobForm";
import { ADD_PLAYLIST_FIRST, PLAYLISTS_UNREAD } from "@/constants/job-copy";
import { createReason } from "@/lib/job-checks";
import { EMPTY_NEW_JOB, draftOf } from "@/lib/job-draft";
import { JobsPage } from "@/pages/JobsPage";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const playlist = (id: number, enabled = true): AdminPlaylist => ({
  id,
  name: `List ${id}`,
  host: "h.test",
  masked: "h.test/…",
  enabled,
  channels: 0,
});
const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob => ({
  id,
  name: `Job ${id}`,
  type: "playlist",
  enabled: true,
  schedule: "24h",
  config: { playlistId: 1, dryRun: false, prune: true },
  playlistName: "List 1",
  running: false,
  createdAt: 1,
  ...extra,
});
const CATALOG: Partial<AdminJob> = { type: "catalog", config: { scope: "popular", kind: "tv", pages: 5 } };
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
  it("has Name, then Type, then a playlist job's Playlist select, the disabled one marked", () => {
    state().jobsPlaylistsLoaded([playlist(1), playlist(2, false)]);
    const html = page();
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Type"'));
    assert.ok(at(html, 'aria-label="Type"') < at(html, 'aria-label="Playlist"'));
    assert.ok(html.includes(">List 1</option>") && html.includes(">List 2 · disabled</option>"));
    assert.ok(!html.includes('aria-label="Scope"') && !html.includes('placeholder="'));
    assert.ok(html.includes('aria-label="Create. Name is required."'));
  });

  /** The Playlist row is always the real select; with none it is natively disabled, no options, no sentence. */
  const disabledSelect = (html: string, reason: string): void => {
    const select = html.match(/<select[^>]*>/)?.[0] ?? "";
    assert.ok(select.includes('disabled=""') && select.includes('aria-label="Playlist"'), select);
    assert.ok(html.includes(`aria-label="Playlist. ${reason}"`));
    for (const text of ["No playlists", "Loading playlists", "Could not read", "Add a playlist<", "<option"]) {
      assert.ok(!html.includes(text), text);
    }
    assert.ok(!html.includes("animate-skel-shimmer"));
  };

  it("keeps the Playlist select, disabled with `Loading.` as its tooltip, while the playlists load", () => {
    for (const start of [false, true]) {
      if (start) state().jobsStartLoad();
      disabledSelect(renderLive(createElement(NewJobForm)), "Loading.");
    }
  });

  it("keeps the Playlist select, disabled with `Add a playlist first.`, once the read answered with none", () => {
    state().jobsPlaylistsLoaded([]);
    const html = renderLive(createElement(NewJobForm));
    disabledSelect(html, "Add a playlist first.");
    assert.ok(html.includes('aria-label="Create. Name is required."'));
  });

  it("gives the Create reason `Add a playlist first.` once named and there are no playlists", () => {
    state().jobsPlaylistsLoaded([]);
    assert.equal(createReason({ ...EMPTY_NEW_JOB, name: "N" }, "", undefined, true), ADD_PLAYLIST_FIRST);
    assert.equal(createReason({ ...EMPTY_NEW_JOB, name: "N" }, "", undefined), "Playlist is required.");
    assert.equal(createReason({ ...EMPTY_NEW_JOB, name: "N" }, "1", undefined, false), undefined);
    assert.equal(createReason({ ...EMPTY_NEW_JOB, name: "N", type: "catalog" }, "", undefined, true), undefined);
  });

  it("keeps the Playlist select, disabled with the failure as its tooltip, when the read failed", () => {
    state().jobsPlaylistsLoaded(null);
    disabledSelect(renderLive(createElement(NewJobForm)), PLAYLISTS_UNREAD);
  });

  it("the workspace Details Playlist row is the same control in the same states", () => {
    const props = { job: job(1), draft: draftOf(job(1)), errors: {}, playlists: [], onChange: () => undefined };
    const details = (): string => renderLive(createElement(JobDetailsGroup, props));
    disabledSelect(details(), "Loading.");
    state().jobsPlaylistsLoaded([]);
    disabledSelect(details(), "Add a playlist first.");
    state().jobsPlaylistsLoaded(null);
    disabledSelect(details(), PLAYLISTS_UNREAD);
    state().jobsPlaylistsLoaded([playlist(1)]);
    const html = renderLive(createElement(JobDetailsGroup, { ...props, playlists: [playlist(1)] }));
    assert.ok(html.includes('aria-label="Playlist"') && html.includes(">List 1</option>"));
  });

  it("offers Playlist and Catalog as the Type; a catalog job's rows are Scope and Kind", () => {
    const html = renderLive(createElement(NewJobForm));
    assert.ok(/aria-pressed="true"[^>]*>Playlist</.test(html) && html.includes(">Catalog</button>"));
    assert.ok(!html.includes('aria-label="Scope"'), "a playlist job by default renders no catalog row");
    const props = { scope: "trending", kind: "movie", onChange: () => undefined } as const;
    const rows = renderLive(createElement(CatalogRows, props));
    assert.ok(at(rows, 'aria-label="Scope"') < at(rows, 'aria-label="Kind"'));
    for (const label of [">Trending<", ">Popular<", ">Movies<", ">Series<"]) assert.ok(rows.includes(label), label);
  });
});

describe("the jobs list", () => {
  it("draws shimmer rows before a read, then the headings, words, the running bar and a dimmed disabled job", () => {
    assert.ok(page().includes("animate-skel-shimmer"));
    state().jobsLoaded([
      job(1, { running: true }),
      job(2, { enabled: false, schedule: "off" }),
      job(3, { ...CATALOG, lastRunAt: 5, lastOutcome: "TMDB down", lastCounts: { titles: 0 } }),
    ]);
    const html = page();
    for (const heading of [">name<", ">type<", ">target<", ">schedule<", ">last run<", ">outcome<", ">state<"]) {
      assert.ok(html.includes(heading), heading);
    }
    assert.ok(html.includes('data-st="running"') && html.includes("animate-pulse-busy"));
    assert.ok(html.includes('data-st="disabled"') && html.includes("opacity-45") && html.includes('data-st="failed"'));
    assert.ok(html.includes(">popular series<") && html.includes(">List 1<") && html.includes(">never<"));
    assert.ok(html.includes('title="A running job cannot be deleted."'));
    assert.ok(html.includes(">Every day<") && html.includes(">Off<"), "the schedule column words");
  });

  it("draws Refresh, then Run job, Enable, Disable and the armed Delete last, waiting for a tick, then enabled", () => {
    state().jobsLoaded([job(1)]);
    let html = page();
    const table = (): string => html.slice(html.indexOf('aria-label="Jobs table"'));
    assert.ok(table().includes('title="Refresh jobs"') && table().includes('aria-label="Run job. Tick a job first"'));
    assert.ok(!html.slice(0, html.indexOf("New job")).includes("Run job"), "no table verb above the New form");
    state().jobTick(1, true);
    html = page();
    for (const verb of ["Run job", "Enable"]) assert.ok(table().includes(`${verb}</button>`), verb);
    assert.ok(at(table(), "Run job") < at(table(), "Enable") && at(table(), "Disable") < at(table(), ">Delete</button>"));
    assert.ok(/lucide-play[^>]*>.*?<\/svg>Run job<\/button>/.test(table()), "Run job is the Play icon and its word");
  });

  it("disables Run job with the gate's reason for a ticked job whose playlist is disabled", () => {
    state().jobsPlaylistsLoaded([playlist(1, false)]);
    state().jobsLoaded([job(1)]);
    state().jobTick(1, true);
    const html = page();
    assert.ok(html.slice(html.indexOf('aria-label="Jobs table"')).includes('aria-label="Run job. A ticked job&#x27;s playlist is disabled."'));
  });
});

describe("a job's workspace", () => {
  it("a playlist job: rail, Details in order, Run with Dry run and Prune, Last run counts, the Channels arrow", () => {
    const counts = { created: 2, updated: 1, refusalExamples: ["bad address"], createdIds: ["ch_a", "ch_b"] };
    state().jobsPlaylistsLoaded([playlist(1)]);
    state().jobsLoaded([job(1, { lastRunAt: 5, lastOutcome: "Synced: 2 created, 1 updated.", lastCounts: counts })]);
    state().openWorkspace("jobs", "1");
    const html = page();
    assert.ok(html.includes('aria-label="Job sections"'));
    for (const [a, b] of [[">Details<", ">Schedule<"], [">Schedule<", ">Run<"], [">Run<", ">Last run<"]]) {
      assert.ok(at(html, a ?? "") < at(html, b ?? ""));
    }
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Type"'));
    assert.ok(html.includes('aria-label="Dry run"') && html.includes('aria-label="Prune"'));
    assert.ok(html.includes("2 created · 1 updated") && html.includes(">bad address<"));
    assert.ok(html.includes(">ch_a</button>"));
    assert.ok(/<button[^>]*title="Go to Channels"[^>]*>Channels →<\/button>/.test(html), "a playlist job's forward verb");
    assert.ok(at(html, "Discard changes") < at(html, "Channels →") && at(html, "Channels →") < at(html, 'id="jw-details"'));
    assert.ok(html.includes('aria-label="Interval"') && html.includes('value="24h"'));
    assert.ok(html.includes('aria-label="Save details. Nothing has changed."'), "the commit ends Schedule");
    assert.ok(html.includes('aria-label="Refresh last run"'), "Refresh is an icon on the State row");
  });

  it("a catalog job: Scope, Kind and Pages, no Dry run, Titles and a shimmer Stale, the Titles arrow", () => {
    state().jobsLoaded([job(4, { ...CATALOG, lastRunAt: 5, lastOutcome: "ok", lastCounts: { titles: 1240 } })]);
    state().openWorkspace("jobs", "4");
    const html = page();
    assert.ok(html.includes('aria-label="Scope"') && html.includes('aria-label="Pages"'));
    assert.ok(!html.includes('aria-label="Dry run"') && !html.includes('aria-label="Playlist"'));
    assert.ok(html.includes(">1240<") && html.includes("animate-skel-shimmer"));
    assert.ok(/<button[^>]*title="Go to Titles"[^>]*>Titles →<\/button>/.test(html), "a catalog job's forward verb");
    assert.ok(html.includes(">Run job</button>"), "an enabled catalog job can run");
    assert.ok(html.split("text-accent-ink").length <= 3, "the primaries are Save details and the page toolbar's Titles →");
  });

  it("disables the workspace's Run job for a disabled job, and shows a bad interval under its row (a row error, not a paragraph)", () => {
    state().jobsLoaded([job(1, { enabled: false })]);
    state().openWorkspace("jobs", "1");
    assert.ok(page().includes('aria-label="Run job. Jobs that are disabled cannot run."'));
    const sentence = "Interval is a number and s, m or h, like 30m or 6h, or off.";
    const props = { value: "x", job: job(1), error: sentence, onChange: () => undefined, save: { onPress: () => undefined } };
    const html = renderLive(createElement(JobScheduleGroup, props));
    assert.ok(html.includes('role="alert"') && html.includes(sentence) && html.includes('aria-invalid="true"'));
  });
});
