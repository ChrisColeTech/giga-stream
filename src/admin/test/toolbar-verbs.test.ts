import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NOTHING_CHANGED } from "@/constants/record-copy";
import { TAB_ORDER } from "@/constants/tabs";
import { providerPreviewReason } from "@/lib/provider-rows";
import { titlePreviewReason } from "@/lib/title-rows";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { changeReason } from "@/lib/workspace-verbs";

describe("Save and Discard changes", () => {
  it("wait with `Nothing has changed.` while the draft equals its baseline, whatever else is true", () => {
    assert.equal(NOTHING_CHANGED, "Nothing has changed.");
    assert.equal(changeReason(false), NOTHING_CHANGED);
    assert.equal(changeReason(false, "Saving."), NOTHING_CHANGED);
  });

  it("are enabled once the draft has changed, or give the page's own reason", () => {
    assert.equal(changeReason(true), undefined);
    const own = "Number must be a whole number from 1 to 9999.";
    assert.equal(changeReason(true, own), own);
  });
});

describe("index preview gates", () => {
  const provider = { id: 1, family: "embed", movieTemplate: "https://x.test/{tmdbId}" } as AdminProvider;
  const title = { id: "movie-1", tmdbId: 1, stored: true } as AdminTitleRow;
  it("require exactly one previewable row", () => {
    assert.equal(providerPreviewReason([], [provider], false), "Tick a row first");
    assert.equal(providerPreviewReason([1, 2], [provider], false), "Tick only one row");
    assert.equal(providerPreviewReason([1], [provider], false), undefined);
    assert.equal(titlePreviewReason(1, title, false), undefined);
  });

  it("refuse a selected row with no preview target", () => {
    assert.equal(providerPreviewReason([1], [{ ...provider, movieTemplate: undefined }], false),
      "That provider cannot be previewed.");
    assert.equal(titlePreviewReason(1, { ...title, tmdbId: undefined }, false), "That title cannot be previewed.");
  });
});

describe("the six index frames", () => {
  it("cover every tab once, with the plan's icons and titles", () => {
    assert.deepEqual(Object.keys(INDEX_FRAMES).sort(), [...TAB_ORDER].sort());
    const titles = TAB_ORDER.map((tab) => [INDEX_FRAMES[tab].newTitle, INDEX_FRAMES[tab].listTitle]);
    assert.deepEqual(titles, [
      ["New channel", "Channels"],
      ["New provider", "Providers"],
      ["New title", "Titles"],
      ["New playlist", "Playlists"],
      ["New job", "Jobs"],
      ["New account", "Accounts"],
    ]);
  });

  it("hold no static cross-tab action", () => {
    for (const tab of TAB_ORDER) assert.equal("forward" in INDEX_FRAMES[tab], false);
  });
});
