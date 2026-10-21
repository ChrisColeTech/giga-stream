import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { blankForStop } from "@/lib/embed-policy";
import { nativeAttachmentKey, pauseForStop } from "@/lib/native-player";
import { videoPlayingOf } from "@/lib/running-work";
import { detachForStop, liveStopApplies } from "@/hooks/useStreamPlayer";
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

describe("stop's playback pause", () => {
  it("pauses the fake element in place - position and source untouched - and tolerates a missing one", () => {
    let pauses = 0;
    const media = { pause: (): void => { pauses += 1; }, currentTime: 11.2, src: "https://media.test/movie.mp4" };
    pauseForStop(media);
    assert.equal(pauses, 1);
    assert.equal(media.currentTime, 11.2, "Stop keeps the position for Resume");
    assert.equal(media.src, "https://media.test/movie.mp4", "Stop never clears or reloads the source");
    pauseForStop(null);
    pauseForStop(undefined);
    assert.equal(pauses, 1, "nothing else pressed");
  });

  it("a post-stop re-answer of the same media re-keys nothing: the teardown never strips the element", () => {
    const playing = "https://media.test/movie.mp4?token=aaa";
    const reAnswered = "https://media.test/movie.mp4?token=bbb";
    assert.equal(nativeAttachmentKey(reAnswered, 0), nativeAttachmentKey(playing, 0),
      "the attachment effect does not re-run on a refreshed query, so its teardown"
      + " (pause + removeAttribute src + load) cannot drop the position to 0");
    assert.equal(nativeAttachmentKey("https://media.test/movie.mp4", 0), nativeAttachmentKey(playing, 0),
      "query against no query is the same media");
    assert.notEqual(nativeAttachmentKey("https://media.test/other.mp4", 0), nativeAttachmentKey(playing, 0),
      "a genuinely different address still re-attaches");
    assert.notEqual(nativeAttachmentKey(playing, 1), nativeAttachmentKey(playing, 0),
      "a Retry still re-attaches");
  });

  it("the stop's pause lands in the store and disarms the playing gate; a play re-arms it", () => {
    const state = () => useAppStore.getState();
    assert.equal(state().playerPaused, true, "a freshly opened item starts paused");
    state().setPlayerSources(
      [{ id: "app", kind: "stream", name: "App player", url: "https://media.test/movie.mp4" }], "app",
    );
    state().setPlayerStage({ kind: "ready" });
    state().setPlayerPaused(false);
    assert.equal(videoPlayingOf(state().playerMedia, state().playerPaused), true, "playing");
    state().setPlayerPaused(true);
    assert.equal(state().playerPaused, true, "the stop's pause reaches the store");
    assert.equal(videoPlayingOf(state().playerMedia, state().playerPaused), false, "so Stop disarms at once");
    state().setPlayerPaused(false);
    assert.equal(videoPlayingOf(state().playerMedia, state().playerPaused), true, "a following play re-arms");
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

describe("the live stop's ownership gate", () => {
  it("detaches only when the controller holds the live slice's stream, and a second press detaches nothing", () => {
    const state = () => useAppStore.getState();
    // The live slice plays a channel; the hook attached the same manifest.
    state().playChannel("news", "https://media.test/news.m3u8", true);
    assert.equal(liveStopApplies("https://media.test/news.m3u8", state().playingStreamUrl), true,
      "the attached manifest is the slice's stream: the live controller detaches on stop");
    // After the stop the slice owns nothing, so a second press detaches nothing.
    state().stopLive();
    assert.equal(state().playingStreamUrl, null);
    assert.equal(liveStopApplies("https://media.test/news.m3u8", state().playingStreamUrl), false,
      "the stale manifest no longer matches: no detach on a repeat stop");
  });

  it("a stop of a player-surface stream runs no live detach: the player video keeps its src and currentTime", () => {
    let detaches = 0;
    let stops = 0;
    const liveController = { detach: (): void => { detaches += 1; } };
    const playerVideo = {
      pause: (): void => { stops += 1; }, currentTime: 11.2, src: "https://media.test/movie.m3u8",
    };
    const state = useAppStore.getState();
    // The live slice owns a background channel (fx-music), but the controller holds the PLAYER's movie manifest.
    state.playChannel("fx-music", "https://media.test/fx.m3u8", true);
    if (liveStopApplies("https://media.test/movie.m3u8", state.playingStreamUrl)) {
      state.stopLive();
      detachForStop(liveController);
    }
    // The player's own stop is the native pause — not the live detach.
    pauseForStop(playerVideo);
    assert.equal(detaches, 0, "the player's stream is not the live slice's; no engine of its is destroyed");
    assert.equal(playerVideo.src, "https://media.test/movie.m3u8", "the player's source survives the stop");
    assert.equal(playerVideo.currentTime, 11.2, "the player's position survives the stop");
    assert.equal(stops, 1, "the player's element paused exactly once");
  });

  it("the pause event flips playerPaused in the store and disarms the playing gate; a play re-arms it", () => {
    const state = () => useAppStore.getState();
    state().setPlayerSources(
      [{ id: "app", kind: "stream", name: "App player", url: "https://media.test/movie.mp4" }], "app",
    );
    state().setPlayerStage({ kind: "ready" });
    // The element's own pause event lands in the store: the gate disarms.
    state().setPlayerPaused(true);
    assert.equal(state().playerPaused, true);
    assert.equal(videoPlayingOf(state().playerMedia, state().playerPaused), false, "paused: the gate is disarmed");
    // A play event re-arms it.
    state().setPlayerPaused(false);
    assert.equal(state().playerPaused, false);
    assert.equal(videoPlayingOf(state().playerMedia, state().playerPaused), true, "playing: the gate is armed");
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
