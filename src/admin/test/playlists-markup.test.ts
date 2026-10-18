import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { PlaylistDetailsGroup } from "@/components/playlists/PlaylistDetailsGroup";
import { PlaylistStatusGroup } from "@/components/playlists/PlaylistStatusGroup";
import { draftOf } from "@/lib/playlist-draft";
import { playlistRow } from "@/lib/playlist-rows";
import { PlaylistsPage } from "@/pages/PlaylistsPage";
import { useAppStore } from "@/store/app-store";
import { counts, filePlaylist, playlist as row } from "./support/run-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const page = (): string => renderLive(createElement(PlaylistsPage, { active: true }));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New playlist form", () => {
  it("opens on Source File: the Source pills, the File row, no Name and no Address", () => {
    const html = page();
    assert.ok(html.includes("New playlist"));
    assert.ok(/aria-pressed="true"[^>]*>File</.test(html) && html.includes(">Web address</button>"));
    assert.ok(at(html, 'aria-label="Source"') < at(html, 'aria-label="File"'));
    assert.ok(!html.includes('aria-label="Name"') && !html.includes('aria-label="Address"'));
    assert.ok(!html.includes('placeholder="'));
  });

  it("disables the one primary Import with `Choose a file first.`, and never offers Create", () => {
    const html = page();
    assert.ok(html.includes('aria-label="Import. Choose a file first."'));
    assert.ok(!html.includes("Create"));
    assert.ok(/<button[^>]*text-accent-ink[^>]*>Import<\/button>/.test(html), "Import is the form's one primary");
  });
});

describe("the playlists list", () => {
  it("draws shimmer rows before a read, with no sentence over them", () => {
    const html = page();
    assert.ok(html.includes("animate-skel-shimmer") && html.includes("Select all playlists"));
    assert.ok(!html.includes("No playlists"));
  });

  it("shows the columns, the host or the file name, the counts, state words, a dimmed disabled row and `never`", () => {
    const ran = new Date(2026, 9, 17, 6, 0).getTime();
    state().playlistsLoaded(
      [
        row(1, { channels: 2598, enabledChannels: 12, online: 1904, offline: 640, lastRunAt: ran }),
        row(2, { enabled: false }),
        filePlaylist(3),
      ],
      {},
    );
    const html = page();
    for (const heading of [">name<", ">source<", ">channels<", ">enabled<", ">online<", ">offline<", ">last run<", ">state<"]) {
      assert.ok(html.includes(heading), heading);
    }
    assert.ok(html.includes(">iptv.example.test</span>") && html.includes(">us.m3u</span>"));
    assert.ok(!html.includes("list.m3u"), "the list shows the host, not the full address");
    assert.ok(html.includes(">2,598<") && html.includes(">1,904<") && html.includes(">640<") && html.includes(">12<"));
    assert.ok(html.includes("2026-10-17 06:00") && html.includes(">never<"));
    assert.ok(html.includes('data-st="enabled"') && html.includes('data-st="disabled"') && html.includes("opacity-45"));
    assert.ok(!html.includes("hunter2") && !html.includes(">host<"));
  });

  it("arms Delete with the question that names the channels that go with the playlist", () => {
    assert.equal(playlistRow(row(1, { name: "Main", channels: 2598 })).deleteQuestion, "Delete Main and its 2,598 channels?");
    assert.equal(playlistRow(row(2, { name: "One", channels: 1 })).deleteQuestion, "Delete One and its 1 channel?");
    state().playlistsLoaded([row(1, { name: "Main", channels: 2598 })], {});
    const html = page();
    assert.ok(html.includes('title="Deletes the playlist, its channels and its job."'), "the rest title says what goes");
    assert.ok(html.includes(">Delete</button>"), "the question appears on the first press");
  });
});

describe("the Playlists table strip", () => {
  it("holds Refresh and no forward verb; Jobs → is the page toolbar's, above the form; the bulk verbs wait for a tick", () => {
    state().playlistsLoaded([row(1)], {});
    const html = page();
    assert.ok(html.indexOf('role="toolbar"') < html.indexOf("New playlist"));
    const top = html.slice(0, html.indexOf("overflow-y-auto"));
    assert.ok(/<button[^>]*title="Go to Jobs"[^>]*>Jobs →<\/button>/.test(top));
    const table = html.slice(html.indexOf('aria-label="Playlists table"'));
    assert.ok(!table.includes("→"));
    assert.ok(table.includes('title="Refresh playlists"'));
    for (const verb of ["Sync now", "Enable", "Disable"]) assert.ok(table.includes(`aria-label="${verb}. Tick `), verb);
  });

  it("gives Sync now its reason for a ticked playlist that has no job, and arms the others", () => {
    state().playlistsLoaded([row(1), row(2, { enabled: false })], { 2: { id: 5, enabled: true, running: false } });
    state().playlistTick(1, true);
    const html = page();
    assert.ok(html.includes('aria-label="Sync now. This playlist has no job to run."'));
    assert.ok(html.includes('aria-label="Enable. Every ticked playlist is already enabled."'));
    assert.ok(html.includes("Disable</button>") && html.includes(">Delete</button>"));
  });
});

describe("a playlist's workspace", () => {
  it("opens with the rail, the page toolbar (Discard, Channels →), Details then Status, the full address, Save details", () => {
    state().playlistsLoaded([row(1)], {});
    state().openWorkspace("playlists", "1");
    const html = page();
    assert.ok(html.includes('aria-label="Playlist sections"') && at(html, ">Details<") < at(html, ">Status<"));
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Address"'));
    assert.ok(/<input[^>]*type="text"[^>]*aria-label="Address"[^>]*value="https:\/\/iptv\.example\.test\/list\.m3u"/.test(html));
    assert.ok(!html.includes("readOnly=\"\"") && !html.includes("Replace") && !html.includes('type="password"'));
    assert.ok(html.includes('role="switch"') && html.includes('aria-checked="true"'));
    assert.ok(html.includes("Discard changes") && html.includes("Save details") && !html.includes(">Save<"));
    assert.ok(/<button[^>]*title="Go to Channels"[^>]*>Channels →<\/button>/.test(html), "the forward verb is Channels →");
    assert.ok(html.indexOf("Discard changes") < html.indexOf("Channels →") && html.indexOf("Channels →") < html.indexOf('id="pw-details"'));
    assert.ok(!html.includes("Jobs →") && !html.includes("Sync now"), "no sync verb and no Jobs arrow in the workspace");
    assert.ok(!html.includes("Channels from this playlist") && !html.includes("<ul"), "no per-channel link list");
  });

  it("disables Channels → with its reason while the playlist has no channels", () => {
    state().playlistsLoaded([row(1, { channels: 0 })], {});
    state().openWorkspace("playlists", "1");
    assert.ok(page().includes('aria-label="Channels →. This playlist has no channels."'));
  });

  it("a web playlist's Address is an editable plain text field holding what the draft holds", () => {
    const playlist = row(1);
    const draft = { ...draftOf(playlist), address: "https://iptv.example.test/new.m3u" };
    const props = { playlist, draft, errors: {}, onChange: () => undefined, save: { onPress: () => undefined } };
    const html = renderLive(createElement(PlaylistDetailsGroup, props));
    assert.ok(/<input[^>]*type="text"[^>]*aria-label="Address"[^>]*value="https:\/\/iptv\.example\.test\/new\.m3u"/.test(html));
    assert.ok(!/<input[^>]*readOnly=""[^>]*aria-label="Address"/.test(html));
  });

  it("a file playlist shows its file name read-only: it has no web address", () => {
    const playlist = filePlaylist(2);
    const props = { playlist, draft: draftOf(playlist), errors: {}, onChange: () => undefined, save: { onPress: () => undefined } };
    const html = renderLive(createElement(PlaylistDetailsGroup, props));
    assert.ok(/<input[^>]*readOnly=""[^>]*aria-label="Address"[^>]*value="us\.m3u"/.test(html));
    assert.ok(!html.includes("Replace"));
  });

  it("Status for a web playlist: Host, Source type, the counts line, Last run, and the run in words from the typed result", () => {
    const ran = new Date(2026, 9, 17, 6, 0).getTime();
    const playlist = row(1, {
      channels: 2598, enabledChannels: 0, online: 1904, offline: 640, lastRunAt: ran, lastResult: "ok",
      lastCounts: counts({ source: "updated", logosCached: 312, online: 1904, offline: 640 }),
    });
    const html = renderLive(createElement(PlaylistStatusGroup, { playlist }));
    for (const label of [">Host<", ">Source type<", ">Channels<", ">Last run<", ">Result<"]) assert.ok(html.includes(label), label);
    assert.ok(html.includes(">iptv.example.test<") && html.includes(">Web address<"));
    assert.ok(html.includes("2,598 channels · 0 enabled · 1,904 online · 640 offline"));
    assert.ok(html.includes("2026-10-17 06:00") && html.includes("Synced: 312 logos cached, 1,904 online, 640 offline."));
    assert.ok(!html.includes("<ul") && !html.includes("animate-skel-shimmer"));
  });

  it("Status for a file playlist: File and Source type File; a playlist that never ran shimmers its result", () => {
    const html = renderLive(createElement(PlaylistStatusGroup, { playlist: filePlaylist(2) }));
    assert.ok(html.includes(">File<") && html.includes(">us.m3u<") && !html.includes(">Host<"));
    assert.ok(html.includes(">File</span>") || html.includes(">File<"));
    assert.ok(html.includes("3 channels · 0 enabled · 0 online · 0 offline") && html.includes(">never<"));
    assert.ok(html.includes("animate-skel-shimmer"));
  });
});
