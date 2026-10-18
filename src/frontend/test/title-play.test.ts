import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { NO_TITLE_SOURCE_REASON } from "@/lib/player-copy";
import { TITLE_LOADING_REASON, titlePlay } from "@/lib/title-play";
import { TitleSchema } from "@/services/schemas/title-schema";
import type { TitleDetail } from "@/types/title";

const sourceless: TitleDetail = { id: "movie-603", kind: "movie", title: "The Matrix", genres: ["Action"], cast: [] };
const movie: TitleDetail = { ...sourceless, streamUrl: "https://stream.test/movie-603.m3u8" };

describe("Title information Play", () => {
  it("is disabled with the backend sentence when the detail came from the fileserver's cache", () => {
    const cached: TitleDetail = { ...sourceless, fromCache: true };
    assert.deepEqual(titlePlay("movie", cached), { playable: false, reason: "The admin backend is not reachable." });
    assert.deepEqual(titlePlay("tv", { ...cached, kind: "tv" }), {
      playable: false, reason: "The admin backend is not reachable.",
    }, "a series cannot reach its episodes either");
  });

  it("plays a live movie with a source and a read series; says why otherwise", () => {
    assert.deepEqual(titlePlay("movie", movie), { playable: true, reason: undefined });
    assert.deepEqual(titlePlay("tv", { ...sourceless, kind: "tv" }), { playable: true, reason: undefined });
    assert.deepEqual(titlePlay("movie", sourceless), { playable: false, reason: NO_TITLE_SOURCE_REASON });
    assert.deepEqual(titlePlay("movie", undefined), { playable: false, reason: TITLE_LOADING_REASON });
    assert.deepEqual(titlePlay(undefined, undefined), { playable: false, reason: LIBRARY_COPY.noItem });
    assert.deepEqual(titlePlay("local", undefined), { playable: true, reason: undefined });
  });
});

describe("title schema", () => {
  it("accepts the fileserver's cached answer with fromCache and no sources", () => {
    const parsed = TitleSchema.parse({ ...sourceless, fromCache: true });
    assert.equal(parsed.fromCache, true);
    assert.equal(TitleSchema.parse({ ...movie }).fromCache, undefined);
    assert.equal(TitleSchema.safeParse({ ...movie, fromCache: false }).success, false);
  });
});
