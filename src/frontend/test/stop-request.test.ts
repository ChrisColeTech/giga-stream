import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { blankForStop } from "@/components/player/EmbedHost";
import { pauseForStop } from "@/components/player/NativePlayer";
import { detachForStop } from "@/hooks/useStreamPlayer";
import type { StreamEngine, StreamEngineFactory } from "@/services/stream-player-engine";
import { StreamPlayerController } from "@/services/stream-player";
import { useAppStore } from "@/store/app-store";
import type { StreamFacts, StreamStageState } from "@/types/stream-player";

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

describe("the stop serial", () => {
  it("starts at zero and bumps per press, so consumers answer each change idempotently", () => {
    const state = () => useAppStore.getState();
    assert.equal(state().stopRequest, 0);
    state().requestStop();
    assert.equal(state().stopRequest, 1);
    state().requestStop();
    assert.equal(state().stopRequest, 2, "a second press is just another change, never a queued one");
  });
});

describe("stop's live store action", () => {
  it("clears the playing markers and returns the stage to its idle note, a stale failure included", () => {
    const state = () => useAppStore.getState();
    state().playChannel("news", "https://media.test/news.m3u8", true);
    state().setLiveStage("failed", "The playlist failed.");
    state().stopLive();
    assert.equal(state().playingChannelId, null, "the channel list's marker goes out with the stream");
    assert.equal(state().playingStreamUrl, null);
    assert.equal(state().liveStage, "idle");
    assert.equal(state().liveStreamError, null, "no stale failure sentence survives the stop");
  });

  it("a following play sets the markers again and bumps the serial exactly as before the stop", () => {
    const state = () => useAppStore.getState();
    state().playChannel("news", "https://media.test/news.m3u8", true);
    const serial = state().livePlaySerial;
    state().stopLive();
    state().playChannel("sport", "https://media.test/sport.m3u8", true);
    assert.equal(state().playingChannelId, "sport");
    assert.equal(state().playingStreamUrl, "https://media.test/sport.m3u8");
    assert.equal(state().liveStage, "loading");
    assert.equal(state().livePlaySerial, serial + 1, "the play after a stop is an ordinary play");
  });
});

describe("stop's consumers", () => {
  it("a fake video element pauses, and a missing one is tolerated", () => {
    let pauses = 0;
    const media = { pause: (): void => { pauses += 1; } };
    pauseForStop(media);
    assert.equal(pauses, 1);
    pauseForStop(null);
    pauseForStop(undefined);
    assert.equal(pauses, 1, "nothing else pressed");
  });

  it("a fake controller detaches, and a missing one is tolerated", () => {
    let detaches = 0;
    const player = { detach: (): void => { detaches += 1; } };
    detachForStop(player);
    assert.equal(detaches, 1);
    detachForStop(null);
    detachForStop(undefined);
    assert.equal(detaches, 1, "nothing else pressed");
  });

  it("a fake live engine detaches back to the idle stage through the real controller", () => {
    class FakeEngine implements StreamEngine {
      levels = [];
      audioTracks = [];
      subtitleTracks = [];
      currentLevel = -1;
      audioTrack = -1;
      subtitleTrack = -1;
      destroyed = false;
      setLowLatency(): void {}
      attach(): void {}
      load(): void {}
      onManifest(): void {}
      onLevel(): void {}
      onFragmentError(): void {}
      onFatal(): void {}
      destroy(): void { this.destroyed = true; }
    }
    const engine = new FakeEngine();
    const factory: StreamEngineFactory = { supported: () => true, create: () => engine };
    const listeners = new Map<string, Set<() => void>>();
    const tracks: TextTrack[] = [];
    const textTracks = Object.assign(tracks, {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    let pauses = 0;
    const element: HTMLVideoElement = Object.assign(Object.create({}), {
      src: "",
      currentTime: 0,
      videoWidth: 0,
      videoHeight: 0,
      textTracks,
      canPlayType: () => "",
      play: () => Promise.resolve(),
      pause: () => { pauses += 1; },
      load: () => undefined,
      removeAttribute: (name: string) => { if (name === "src") element.src = ""; },
      addEventListener: (type: string, callback: () => void) => {
        const rows = listeners.get(type) ?? new Set<() => void>();
        rows.add(callback);
        listeners.set(type, rows);
      },
      removeEventListener: (type: string, callback: () => void) => listeners.get(type)?.delete(callback),
    });
    const states: Array<{ state: StreamStageState; reason?: string }> = [];
    const facts: StreamFacts[] = [];
    const controller = new StreamPlayerController(element, {
      videoQuality: "auto", audioLanguage: null, subtitleLanguage: null, lowLatency: false,
    }, {
      onState: (state, reason) => states.push({ state, reason }),
      onFacts: (report) => facts.push(report),
    }, factory);

    controller.attach({ url: "https://media.test/live.m3u8", autoplay: false, userInitiated: false });
    assert.equal(states.at(-1)?.state, "loading");
    detachForStop(controller);
    assert.equal(engine.destroyed, true, "the engine is gone");
    assert.equal(states.at(-1)?.state, "idle", "the stage is back to its idle note");
    assert.ok(pauses >= 1, "the element is paused");
    assert.ok(facts.length >= 2, "facts were cleared on attach and detach");
    controller.destroy();
  });

  it("a fake embed blanks through the embed policy, and a missing frame is tolerated", () => {
    const frame = { src: "https://player.example/watch" };
    blankForStop(frame);
    assert.equal(frame.src, "about:blank");
    blankForStop(null);
    blankForStop(undefined);
  });
});
