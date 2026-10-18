import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { PlaylistDetailsGroup } from "@/components/playlists/PlaylistDetailsGroup";
import { PlaylistStatusGroup } from "@/components/playlists/PlaylistStatusGroup";
import { draftOf, startReplace } from "@/lib/playlist-draft";
import { PlaylistsPage } from "@/pages/PlaylistsPage";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const row = (id: number, extra: Partial<AdminPlaylist> = {}): AdminPlaylist => ({
  id,
  name: `List ${id}`,
  host: `h${id}.example.test`,
  masked: `h${id}.example.test/…`,
  enabled: true,
  channels: 3,
  ...extra,
});
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
  it("has Name first, then Address as a password field with autocomplete off, and no placeholder", () => {
    const html = page();
    assert.ok(html.includes("New playlist"));
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Address"'));
    assert.ok(/<input[^>]*type="password"[^>]*aria-label="Address"[^>]*autoComplete="off"/.test(html));
    assert.ok(!html.includes('placeholder="'));
  });

  it("disables Create with `Address is required.` and never for the Name", () => {
    const html = page();
    assert.ok(html.includes('aria-label="Create. Address is required."'));
    assert.ok(!html.includes("Name is required."));
  });
});

describe("the playlists list", () => {
  it("draws shimmer rows before a read, with no sentence over them", () => {
    const html = page();
    assert.ok(html.includes("animate-skel-shimmer") && html.includes("Select all playlists"));
    assert.ok(!html.includes("No playlists"));
  });

  it("shows the headings, the host never the address, state words, a dimmed disabled row and `never`", () => {
    const synced = new Date(2026, 9, 17, 6, 0).getTime();
    state().playlistsLoaded([row(1, { lastSyncedAt: synced }), row(2, { enabled: false })], {});
    const html = page();
    for (const heading of [">name<", ">host<", ">channels<", ">last synced<", ">state<"]) {
      assert.ok(html.includes(heading), heading);
    }
    assert.ok(html.includes("h1.example.test") && html.includes("2026-10-17 06:00") && html.includes(">never<"));
    assert.ok(html.includes('data-st="enabled"') && html.includes('data-st="disabled"') && html.includes("opacity-45"));
    assert.ok(html.includes('title="The channels it created stay, as hand-made rows that no sync touches."'));
  });
});

describe("the Playlists table strip", () => {
  it("holds the Jobs arrow and Refresh, no bar above the form; the bulk verbs wait for a tick", () => {
    state().playlistsLoaded([row(1)], {});
    const html = page();
    assert.ok(html.indexOf('role="toolbar"') > html.indexOf("New playlist"));
    const table = html.slice(html.indexOf('aria-label="Playlists table"'));
    assert.ok(/<button[^>]*aria-label="Go to Jobs"/.test(table));
    assert.ok(table.includes('aria-label="Refresh playlists"'));
    for (const verb of ["Sync now", "Enable", "Disable"]) assert.ok(!table.includes(`aria-label="${verb}`), verb);
  });

  it("gives Sync now its reason for a ticked playlist that no job syncs, and arms the others", () => {
    state().playlistsLoaded([row(1), row(2, { enabled: false })], { 2: { id: 5, enabled: true, running: false } });
    state().playlistTick(1, true);
    const html = page();
    assert.ok(html.includes('aria-label="Sync now. No job syncs this playlist; create one on the Jobs tab."'));
    assert.ok(html.includes('aria-label="Enable. Every ticked playlist is already enabled."'));
    assert.ok(/<button[^>]*aria-label="Disable"/.test(html) && html.includes(">Delete</button>"));
  });
});

describe("a playlist's workspace", () => {
  it("opens with the rail, Details then Status, the masked address with Replace, the pinned Discard and Save details", () => {
    state().playlistsLoaded([row(1)], {});
    state().openWorkspace("playlists", "1");
    const html = page();
    assert.ok(html.includes('aria-label="Playlist sections"') && at(html, ">Details<") < at(html, ">Status<"));
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Address"'));
    assert.ok(/<input[^>]*readOnly=""[^>]*aria-label="Address"[^>]*value="h1\.example\.test\/…"/.test(html));
    assert.ok(html.includes(" Replace</button>") && !html.includes('type="password"'));
    assert.ok(html.includes('role="switch"') && html.includes('aria-checked="true"'));
    assert.ok(html.includes("Discard changes") && html.includes("Save details") && !html.includes(">Save<"));
    assert.ok(!html.includes("Jobs →"));
    assert.ok(!html.includes("Sync now"), "no sync verb in a playlist's workspace");
  });

  it("Replace unlocks an empty password field and disables itself with its reason", () => {
    const playlist = row(1);
    const draft = startReplace(draftOf(playlist));
    const props = { playlist, draft, errors: {}, onChange: () => undefined, save: { onPress: () => undefined } };
    const html = renderLive(createElement(PlaylistDetailsGroup, props));
    assert.ok(/<input[^>]*type="password"[^>]*aria-label="Address"[^>]*value=""/.test(html));
    assert.ok(html.includes('aria-label="Replace. Type the new value, then Save."'));
    assert.ok(!html.includes("h1.example.test/…"), "the masked form is gone while unlocked");
  });

  it("Status draws shimmer lines while the channels are unread or refused, and links once read", () => {
    const playlist = row(1, { lastOutcome: "Synced: 3 created, 12 updated." });
    const refused = renderLive(createElement(PlaylistStatusGroup, { playlist, channels: { status: "refused" } }));
    assert.ok(refused.includes("animate-skel-shimmer") && !refused.includes("Channels from this playlist"));
    const ready = renderLive(
      createElement(PlaylistStatusGroup, {
        playlist,
        channels: { status: "ready", items: [{ id: "ch_1", name: "News One" }] },
      }),
    );
    assert.ok(ready.includes(">News One</button>") && ready.includes("Synced: 3 created, 12 updated."));
    assert.ok(ready.includes("h1.example.test") && ready.includes(">never<"));
  });
});
