import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { hasSourceChoice, playableSources, sameSources, selectedPlayerSource } from "@/lib/player-sources";
import { playerStageRender } from "@/lib/player-render-state";
import type { TitleSource } from "@/services/schemas/source-schema";
import { useAppStore } from "@/store/app-store";

const provider = (providerId: number, order: number): TitleSource => ({
  providerId,
  order,
  name: `Provider ${providerId}`,
  url: `https://provider${providerId}.example/embed`,
  origin: `https://provider${providerId}.example`,
});

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

describe("Player source selection", () => {
  it("sorts provider sources by order and id, with App player last", () => {
    const sources = playableSources([provider(9, 2), provider(8, 1), provider(7, 1)], "https://stream.example/a.m3u8");
    assert.deepEqual(sources.map((source) => source.id), ["provider:7", "provider:8", "provider:9", "app"]);
    assert.equal(hasSourceChoice(sources), true);
    assert.equal(hasSourceChoice(sources.slice(0, 1)), false);
  });

  it("lets a session switch sources and resets the next item to its first source", () => {
    const first = playableSources([provider(1, 1), provider(2, 2)], undefined);
    useAppStore.getState().setPlayerSources(first, first[0]?.id ?? null);
    useAppStore.getState().setPlayerSource("provider:2");
    assert.equal(useAppStore.getState().playerMedia.activeSourceId, "provider:2");
    const next = playableSources([provider(4, 1), provider(3, 2)], undefined);
    useAppStore.getState().setPlayerSources(next, next[0]?.id ?? null);
    assert.equal(useAppStore.getState().playerMedia.activeSourceId, "provider:4");
  });

  it("uses the first source while the store synchronizes its active id", () => {
    const sources = playableSources([provider(1, 1), provider(2, 2)], undefined);
    assert.equal(selectedPlayerSource(sources, null)?.id, "provider:1");
    assert.equal(selectedPlayerSource(sources, "old-item-source")?.id, "provider:1");
  });
});

describe("sameSources (the identity-only recompute guard)", () => {
  const first = playableSources([provider(1, 1), provider(2, 2)], "https://stream.example/a.m3u8");

  it("answers true for a fresh recompute of the same media (new objects, same sources)", () => {
    const again = playableSources([provider(1, 1), provider(2, 2)], "https://stream.example/a.m3u8");
    assert.notEqual(first, again, "the recompute produces new objects");
    assert.equal(sameSources(first, again), true, "the stage must not reset for the same media");
    assert.equal(sameSources(first, first), true);
    assert.equal(sameSources([], []), true);
  });

  it("answers false when the media, its order or its count changed", () => {
    const moved = playableSources([provider(2, 1), provider(1, 2)], "https://stream.example/a.m3u8");
    assert.equal(sameSources(first, moved), false, "a different order is a different selection");
    const otherStream = playableSources([provider(1, 1), provider(2, 2)], "https://stream.example/b.m3u8");
    assert.equal(sameSources(first, otherStream), false);
    assert.equal(sameSources(first, playableSources([provider(1, 1)], undefined)), false);
    assert.equal(sameSources(first, playableSources([provider(1, 1), provider(2, 2)], undefined)), false,
      "losing the app stream changes the media");
  });

  it("answers true when the play address only re-minted its query (a per-request token or signature)", () => {
    const minted = playableSources([provider(1, 1)], "https://stream.example/a.m3u8?token=aaa");
    const reminted = playableSources([provider(1, 1)], "https://stream.example/a.m3u8?token=bbb&sig=c");
    assert.equal(sameSources(minted, reminted), true, "the same media with a refreshed query");
    assert.equal(sameSources(minted, playableSources([provider(1, 1)], "https://stream.example/a.m3u8")), true,
      "query against no query: the address minus its query is the same media");
    assert.equal(sameSources(minted, playableSources([provider(1, 1)], "https://stream.example/a/1.m3u8?token=aaa")),
      false, "a different path is a genuine change");
    assert.equal(sameSources(minted, playableSources([provider(1, 1)], "https://mirror.example/a.m3u8?token=aaa")),
      false, "a different host is a genuine change");
  });

  it("compares an embed address's stable part too", () => {
    const session = (url: string) => [{
      id: "provider:1", kind: "embed" as const, name: "Provider 1",
      embed: { ...provider(1, 1), url },
    }];
    assert.equal(sameSources(session("https://provider1.example/embed?session=1"),
      session("https://provider1.example/embed?session=2")), true);
    assert.equal(sameSources(session("https://provider1.example/embed?session=1"),
      session("https://provider1.example/watch?session=1")), false);
  });
});

describe("Player stage rendering", () => {
  const native = playableSources([], "https://stream.example/movie.mp4")[0];
  const embed = playableSources([provider(1, 1)], undefined)[0];

  it("keeps idle, pending, and source refusal distinct", () => {
    assert.equal(playerStageRender(false, false, undefined, { kind: "idle" }), "idle");
    assert.equal(playerStageRender(true, true, undefined, { kind: "loading" }), "loading");
    assert.equal(playerStageRender(true, false, undefined, { kind: "idle" }, true), "awaiting-resume");
    assert.equal(playerStageRender(true, false, undefined, { kind: "idle" }, false, false), "choose-episode");
    assert.equal(playerStageRender(true, false, undefined, { kind: "idle" }, false, true, false), "unavailable");
    assert.equal(playerStageRender(true, false, undefined, { kind: "failed", reason: "No source" }), "no-source");
  });

  it("mounts only the host selected by a playable source", () => {
    assert.equal(playerStageRender(true, false, native, { kind: "ready" }), "native");
    assert.equal(playerStageRender(true, false, embed, { kind: "ready" }), "embed");
    assert.equal(playerStageRender(true, false, native, { kind: "failed", reason: "Failed" }), "native-failed");
    assert.equal(playerStageRender(true, false, embed, { kind: "failed", reason: "Failed" }), "embed-failed");
  });
});

describe("the saved default source", () => {
  const sources = playableSources([provider(1, 1), provider(2, 2)], "https://stream.example/a.m3u8");

  it("is selected when the item offers it, whatever its position", () => {
    assert.equal(selectedPlayerSource(sources, "provider:2")?.id, "provider:2");
    assert.equal(selectedPlayerSource(sources, "app")?.id, "app");
  });

  it("falls back to the first source when the item does not offer it, or none is saved", () => {
    assert.equal(selectedPlayerSource(sources, "provider:9")?.id, "provider:1");
    assert.equal(selectedPlayerSource(sources, null)?.id, "provider:1");
    assert.equal(selectedPlayerSource([], "provider:2"), undefined);
  });

  it("is saved by a pick and left alone by an item that lacks it", () => {
    const store = useAppStore.getState();
    assert.equal(store.playback.defaultSource, null);
    store.setPlayback({ defaultSource: "provider:2" });
    const other = playableSources([provider(1, 1)], undefined);
    store.setPlayerSources(other, selectedPlayerSource(other, useAppStore.getState().playback.defaultSource)?.id ?? null);
    assert.equal(useAppStore.getState().playerMedia.activeSourceId, "provider:1");
    assert.equal(useAppStore.getState().playback.defaultSource, "provider:2");
    assert.ok(useAppStore.getState().settingsRevision > 0, "the pick marks settings changed so the write-back saves it");
  });
});
