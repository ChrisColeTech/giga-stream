import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { hasSourceChoice, playableSources } from "@/lib/player-sources";
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
});
