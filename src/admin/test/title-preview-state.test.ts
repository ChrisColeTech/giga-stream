import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAILED_WORD, NO_SOURCE_WORD, READY_WORD, READING_WORD } from "@/constants/preview-copy";
import {
  defaultPreviewSource,
  episodeSourceViews,
  firstSeasonOf,
  resolvePreviewSource,
  sourceViews,
  titlePreviewTarget,
  titlePreviewWord,
} from "@/lib/title-preview-state";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";

/* The title preview window's own state (`55` decision 8), pure. */

const source = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  providerId: 11,
  name: "VidSrc",
  url: "https://vidsrc.sh/embed/movie/603",
  origin: "https://vidsrc.sh",
  order: 1,
  ...extra,
});

describe("the detail's sources as the select's rows", () => {
  it("narrow in the backend's order, an unreadable one costing itself only", () => {
    const views = sourceViews([source(), { name: "Broken" }, source({ providerId: 22, name: "VixSrc" }), 7, null]);
    assert.deepEqual(views.map((one) => [one.id, one.name]), [["11", "VidSrc"], ["22", "VixSrc"]]);
  });

  it("fall back to the address's own origin, and carry the frame origins for the policy", () => {
    const plain = sourceViews([source({ origin: undefined })])[0];
    assert.deepEqual([plain?.origin, plain?.frameOrigins], ["https://vidsrc.sh", []]);
    const nested = sourceViews([source({ origin: undefined, frameOrigins: ["https://cdn.v.test"] })])[0];
    assert.deepEqual(nested?.frameOrigins, ["https://cdn.v.test"]);
  });

  it("name a source without a provider id by its address", () => {
    assert.equal(sourceViews([source({ providerId: undefined })])[0]?.id, "https://vidsrc.sh/embed/movie/603");
  });
});

describe("a series' first episode's sources", () => {
  it("are the first episode that carries any, in the season's own order", () => {
    const episodes = [
      { episode: 1, sources: [source()] },
      { episode: 2, sources: [source({ name: "Second" })] },
    ];
    assert.equal(episodeSourceViews(episodes)[0]?.name, "VidSrc");
    assert.equal(episodeSourceViews([{ episode: 1 }, { episode: 2, sources: [source({ name: "Third" })] }])[0]?.name, "Third");
  });

  it("are none when no episode carries any, and an unreadable source costs itself", () => {
    assert.deepEqual(episodeSourceViews([{ episode: 1 }, { episode: 2 }]), []);
    assert.deepEqual(episodeSourceViews([{ episode: 1, sources: [{ name: "Broken" }] }, { episode: 2, sources: [] }]), []);
  });
});

describe("the season a series reads", () => {
  it("is the first of the detail's own list, season 1 when it names none", () => {
    const detail = { seasons: [{ season: 3 }, { season: 1 }] } as Pick<AdminTitleDetail, "seasons">;
    assert.equal(firstSeasonOf(detail), 3);
    assert.equal(firstSeasonOf({} as Pick<AdminTitleDetail, "seasons">), 1);
  });
});

describe("the resolved choice and the frame's target", () => {
  const views = sourceViews([source(), source({ providerId: 22, name: "VixSrc" })]);
  it("keeps a chosen source while it is still offered, and defaults to the backend's first", () => {
    assert.equal(defaultPreviewSource(views)?.name, "VidSrc");
    assert.equal(resolvePreviewSource(views, "22")?.name, "VixSrc");
    assert.equal(resolvePreviewSource(views, "99")?.name, "VidSrc", "a gone choice falls back to the default");
    assert.equal(resolvePreviewSource(views, null)?.name, "VidSrc");
  });

  it("plays the chosen source's own address with its origins", () => {
    assert.deepEqual(titlePreviewTarget(views[0]), {
      address: "https://vidsrc.sh/embed/movie/603",
      origin: "https://vidsrc.sh",
      frameOrigins: [],
    });
    assert.equal(titlePreviewTarget(undefined), null);
  });
});

describe("the status bar's word", () => {
  it("says loading while the reads run, failed when the season read failed", () => {
    assert.equal(titlePreviewWord(false, true, false, []), READING_WORD);
    assert.equal(titlePreviewWord(false, false, true, []), FAILED_WORD);
  });

  it("says missing when the detail read failed, whatever else is true", () => {
    assert.equal(titlePreviewWord(true, true, true, []), "missing");
  });

  it("says no source when there is nothing to choose, and ready once the frame has its address", () => {
    assert.equal(titlePreviewWord(false, false, false, []), NO_SOURCE_WORD);
    assert.equal(titlePreviewWord(false, false, false, [source()]), READY_WORD);
  });
});