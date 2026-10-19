import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/* `01` sections 4.4, 6 and 9 as a source scan: the grammar the admin broke once and must not break again. A render test
 * cannot see a button a heading could have carried, a timer that is never armed in a test, or a verb a toolbar grew back. */
const SRC = fileURLToPath(new URL("../src", import.meta.url));
const SHARED = fileURLToPath(new URL("../../shared/ui/src", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? files(join(dir, item.name)) : /\.(ts|tsx)$/.test(item.name) ? [join(dir, item.name)] : [],
  );
}

const read = (path: string): { path: string; text: string } => ({ path, text: readFileSync(path, "utf8") });
const SOURCES = files(SRC).map(read);
const COMPONENTS = SOURCES.filter((source) => /[\\/]components[\\/].*\.tsx$/.test(source.path));
const rel = (path: string): string => path.slice(SRC.length).replaceAll("\\", "/");
const offenders = (list: readonly { path: string; text: string }[], pattern: RegExp): string[] =>
  list.filter((source) => pattern.test(source.text)).map((source) => rel(source.path));

describe("a heading carries no button", () => {
  it("never receives an action: no Group or ListGroup in the admin is given an `action` prop", () => {
    assert.deepEqual(offenders(COMPONENTS, /<(?:List)?Group\b[^>]*\baction=/), []);
  });

  it("is a role with no slot: the library Group and the admin ListGroup declare no action", () => {
    const group = read(join(SHARED, "form", "Group.tsx")).text;
    const code = group.replace(/\/\*\*[\s\S]*?\*\//g, "");
    assert.ok(!/\baction\b/.test(code), "Group.tsx has no action prop");
    const list = read(join(SRC, "components", "records", "ListGroup.tsx")).text.replace(/\/\*\*[\s\S]*?\*\//g, "");
    assert.ok(!/\baction\b/.test(list), "ListGroup.tsx has no action prop");
  });

  it("is drawn without a Button or IconButton", () => {
    const group = read(join(SHARED, "form", "Group.tsx")).text;
    assert.ok(!/<(?:Icon)?Button\b/.test(group) && !/controls\/(?:Icon)?Button/.test(group));
    const list = read(join(SRC, "components", "records", "ListGroup.tsx")).text;
    assert.ok(!/<(?:Icon)?Button\b/.test(list));
  });
});

describe("every page has its page toolbar (LoRA Trainer Toolbar.tsx, DatasetsIndex.tsx)", () => {
  it("opens every index with IndexToolbar and every workspace frame with a toolbar, both on the family Toolbar", () => {
    const indexes = COMPONENTS.filter((source) => /[\\/]\w+Index\.tsx$/.test(source.path) && !/IndexSkeleton/.test(source.path));
    assert.equal(indexes.length, 6);
    assert.deepEqual(indexes.filter((source) => !/<IndexToolbar\b/.test(source.text)).map((source) => rel(source.path)), []);
    const frame = read(join(SRC, "components", "chrome", "WorkspaceFrame.tsx")).text;
    assert.ok(/\{toolbar\}\s*\{children\}/.test(frame), "the toolbar comes first in the centre");
    for (const name of ["IndexToolbar.tsx", "WorkspaceToolbar.tsx"]) {
      assert.ok(/<Toolbar\b/.test(read(join(SRC, "components", "records", name)).text), name);
    }
    assert.deepEqual(offenders(SOURCES, /ToolbarStrip|ChannelsToolbar/), []);
  });

  it("keeps the forward verb out of the list's first row: no TableStrip is given a forward verb", () => {
    assert.deepEqual(offenders(COMPONENTS, /<TableStrip\b[^>]*\bforward=/), []);
    assert.ok(!/\bforward\b/.test(read(join(SHARED, "lists", "TableStrip.tsx")).text.replace(/\/\*[\s\S]*?\*\//g, "")));
  });

  it("draws no one-of choice at the field size: no `field` prop on Segmented or ChipGroup", () => {
    assert.deepEqual(offenders(COMPONENTS, /<(?:Segmented|ChipGroup)\b[^>]*(?:\n[^>]*)*?\n?\s+field\b(?!\w)[^=]/), []);
    assert.deepEqual(offenders(COMPONENTS, /<(?:Segmented|ChipGroup) field\b/), []);
  });

  it("holds no Segmented in a table strip (a choice is for a labelled row)", () => {
    assert.ok(!/Segmented/.test(read(join(SHARED, "lists", "TableStrip.tsx")).text));
  });
});

describe("choice-control inventory", () => {
  const segmented = [
    ["channels/NewChannelRows.tsx", "channels/NewChannelRows.tsx", "KINDS", "channels.new", "channels.index"],
    ["channels/LiveDetailsGroup.tsx", "channels/LiveDetailsGroup.tsx", "PLAYS", "live.details", "channels.live"],
    ["channels/PlaybackGroup.tsx", "channels/PlaybackGroup.tsx", "MODES", "live.playback", "channels.live"],
    ["providers/NewProviderForm.tsx", "../constants/provider-copy.ts", "FAMILY_OPTIONS", "providers.new", "providers.index"],
    ["providers/ProviderDetailsGroup.tsx", "../constants/provider-copy.ts", "FAMILY_OPTIONS", "provider.details", "provider.edit"],
    ["titles/NewTitleForm.tsx", "../constants/title-copy.ts", "KIND_OPTIONS", "titles.new", "titles.index"],
    ["titles/TitleListGroup.tsx", "../constants/title-stored-copy.ts", "VIEW_OPTIONS", "titles.list", "titles.index"],
    ["playlists/NewPlaylistForm.tsx", "playlists/NewPlaylistForm.tsx", "SOURCES", "playlists.new", "playlists.index"],
    ["settings/AppearanceSection.tsx", "settings/AppearanceSection.tsx", "THEMES", "appearance.theme", "appearance"],
    ["settings/AppearanceSection.tsx", "settings/AppearanceSection.tsx", "MOTIONS", "appearance.motion", "appearance"],
  ] as const;

  it("inventories every admin Segmented and pins every option source to exactly two", () => {
    const found = COMPONENTS.reduce((total, source) => total + (source.text.match(/<Segmented\b/g) ?? []).length, 0);
    assert.equal(found, segmented.length);
    for (const [component, optionsFile, name] of segmented) {
      const text = read(join(SRC, "components", component)).text;
      assert.ok(new RegExp(`options=\\{${name}\\}`).test(text), `${component}: ${name}`);
      const options = read(join(SRC, optionsFile)).text.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\][^;]*;`))?.[1] ?? "";
      assert.equal((options.match(/\{\s*value:/g) ?? []).length, 2, `${name} must be exactly two`);
    }
  });

  it("keeps at most one pair per group and two per page", () => {
    const groups = segmented.map((entry) => entry[3]);
    const pages = segmented.map((entry) => entry[4]);
    for (const group of new Set(groups)) assert.equal(groups.filter((one) => one === group).length, 1, group);
    for (const page of new Set(pages)) assert.ok(pages.filter((one) => one === page).length <= 2, page);
  });

  it("has no supplied-choice ChipGroup or ad-hoc aria-pressed pill cloud", () => {
    assert.deepEqual(offenders(COMPONENTS, /\bChipGroup\b/), []);
    assert.deepEqual(offenders(COMPONENTS, /aria-pressed=/), []);
  });
});

describe("a table's actions are its strip's", () => {
  it("leaves no BulkNotes list under a toolbar: a run speaks on the notice line and in the Events drawer", () => {
    assert.deepEqual(offenders(SOURCES, /BulkNotes|Bulk action results/), []);
  });

  it("has every index list group draw a TableStrip", () => {
    const lists = COMPONENTS.filter((source) => /(?:Accounts|Channels|Providers|Playlists|Jobs)List\.tsx$/.test(source.path));
    assert.equal(lists.length, 5);
    assert.deepEqual(lists.filter((source) => !/<TableStrip\b/.test(source.text)).map((source) => rel(source.path)), []);
    for (const name of ["titles/TitleStoredList.tsx", "titles/TitleBrowseList.tsx", "titles/DeletedTitlesGroup.tsx"]) {
      assert.ok(/<TableStrip\b/.test(read(join(SRC, "components", name)).text), name);
    }
  });
});

describe("the admin owns no timer", () => {
  it("arms no setTimeout, setInterval, animation-frame loop or debounce anywhere in src/admin/src", () => {
    assert.deepEqual(
      offenders(SOURCES, /\bsetTimeout\b|\bsetInterval\b|requestAnimationFrame|requestIdleCallback|debounce|throttle/),
      [],
    );
  });
});

describe("a component renders props", () => {
  const code = COMPONENTS.map((source) => ({ path: source.path, text: source.text.replace(/\/\*[\s\S]*?\*\//g, "") }));

  it("calls no dialog and touches no window, document or storage", () => {
    assert.deepEqual(offenders(code, /\balert\(|\bconfirm\(|\bprompt\(|\bwindow\.|\bdocument\.|\blocalStorage/), []);
  });

  it("owns no global listener", () => {
    assert.deepEqual(offenders(code, /addEventListener|removeEventListener/), []);
  });

  it("exports one component per file", () => {
    const many = COMPONENTS.filter((source) => (source.text.match(/^export function [A-Z]/gm) ?? []).length > 1);
    assert.deepEqual(many.map((source) => rel(source.path)), []);
  });
});

describe("every form row carries its info glyph", () => {
  it("gives each Row of a New form or a workspace a `tip` in its opening tag (the family look: Name has one too)", () => {
    const forms = COMPONENTS.filter((source) => !/[\\/]session[\\/]/.test(source.path));
    const bare = forms.filter((source) =>
      [...source.text.matchAll(/<Row\b/g)].some(
        (hit) => !/^<Row\b[^>]*tip=/.test(source.text.slice(hit.index, hit.index + 260).replace(/\n\s*/g, " ")),
      ),
    );
    assert.deepEqual(bare.map((source) => rel(source.path)), []);
  });
});

describe("a loading or empty list is skeleton rows, never a sentence", () => {
  it("renders no paragraph in the list groups, the table strip or the workspace frames", () => {
    const frames = COMPONENTS.filter((source) => /(?:List|Rows|Frame|Strip|Index)\w*\.tsx$/.test(source.path));
    assert.deepEqual(offenders(frames, /<p[\s>]/), []);
    assert.ok(!/<p[\s>]/.test(read(join(SHARED, "lists", "TableStrip.tsx")).text));
  });
});
