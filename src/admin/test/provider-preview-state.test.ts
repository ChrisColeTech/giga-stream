import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAILED_WORD, NO_TITLE_WORD, READY_WORD, READING_WORD } from "@/constants/preview-copy";
import {
  defaultPreviewTitle,
  previewTitleRows,
  providerPreviewTarget,
  providerPreviewWord,
  resolvePreviewTitle,
} from "@/lib/provider-preview-state";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

/* The provider preview window's own state (`55` decision 7), pure. */

const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: "movie",
  title: `T ${id}`,
  year: 1999,
  state: "synced",
  enabled: true,
  tmdbId: Number(id.slice(1)),
  ...extra,
});

const provider = (extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id: 1,
  name: "VidSrc",
  source: "vidsrc",
  is_active: true,
  order: 1,
  family: "embed",
  movieTemplate: "https://vidsrc.sh/embed/movie/{tmdbId}",
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});

describe("the Title select's rows", () => {
  it("are the stored movies with a TMDB id, in the list's own order; series and id-less rows are not offered", () => {
    const rows = [
      row("m1"),
      row("t2", { kind: "tv" }),
      row("m3", { tmdbId: undefined }),
      row("m4"),
    ];
    assert.deepEqual(previewTitleRows(rows).map((one) => one.id), ["m1", "m4"]);
    assert.equal(defaultPreviewTitle(rows)?.id, "m1", "the first stored movie with a TMDB id is the default");
  });
});

describe("the resolved choice", () => {
  it("keeps a chosen title while it is still held", () => {
    const rows = [row("m1"), row("m4")];
    assert.equal(resolvePreviewTitle(rows, "m4")?.id, "m4");
  });

  it("falls back to the default when nothing was chosen, and when the choice is gone", () => {
    const rows = [row("m1"), row("m4")];
    assert.equal(resolvePreviewTitle(rows, null)?.id, "m1");
    assert.equal(resolvePreviewTitle(rows, "m99")?.id, "m1");
    assert.equal(resolvePreviewTitle([], "m4"), undefined, "nothing held: nothing to show");
  });
});

describe("the frame's target", () => {
  it("is the provider's template filled with the chosen title's TMDB id", () => {
    assert.equal(providerPreviewTarget(provider(), row("m603"))?.address, "https://vidsrc.sh/embed/movie/603");
    assert.equal(providerPreviewTarget(provider(), row("m3", { tmdbId: undefined })), null);
    assert.equal(providerPreviewTarget(undefined, row("m603")), null);
    assert.equal(providerPreviewTarget(provider(), undefined), null);
  });
});

describe("the status bar's word", () => {
  const target = providerPreviewTarget(provider(), row("m1"));
  it("says loading while the stored titles are read, and failed when the read failed", () => {
    assert.equal(providerPreviewWord(provider(), true, false, target), READING_WORD);
    assert.equal(providerPreviewWord(provider(), false, true, target), FAILED_WORD);
  });

  it("says missing when the provider is gone, whatever else is true", () => {
    assert.equal(providerPreviewWord(undefined, true, true, null), "missing");
    assert.equal(providerPreviewWord(undefined, false, false, target), "missing");
  });

  it("says no title when there is nothing to play, and ready once the frame has its address", () => {
    assert.equal(providerPreviewWord(provider(), false, false, null), NO_TITLE_WORD);
    assert.equal(providerPreviewWord(provider(), false, false, target), READY_WORD);
  });
});