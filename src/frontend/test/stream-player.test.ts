import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EventInput } from "@/lib/event-log";
import { registerLiveStreamTarget, requestLiveStream } from "@/services/live-stream-session";
import type {
  StreamEngine,
  StreamEngineFactory,
} from "@/services/stream-player-engine";
import { StreamPlayerController } from "@/services/stream-player";
import type { StreamFacts, StreamStageState } from "@/types/stream-player";

class FakeEngine implements StreamEngine {
  levels = [{ width: 640, height: 360, bitrate: 800_000 }, { width: 1280, height: 720, bitrate: 2_500_000 }];
  audioTracks = [{ name: "English", lang: "en" }, { name: "Spanish", lang: "es" }];
  subtitleTracks = [{ name: "English", lang: "en" }];
  liveSyncPosition = 12;
  currentLevel = -1;
  audioTrack = 0;
  subtitleTrack = -1;
  lowLatency = false;
  attached = false;
  destroyed = false;
  loaded = "";
  manifest?: () => void;
  level?: () => void;
  fragmentError?: (reason: string) => void;
  fatal?: (reason: string) => void;
  attach(): void { this.attached = true; }
  load(url: string): void { this.loaded = url; }
  onManifest(callback: () => void): void { this.manifest = callback; }
  onLevel(callback: () => void): void { this.level = callback; }
  onFragmentError(callback: (reason: string) => void): void { this.fragmentError = callback; }
  onFatal(callback: (reason: string) => void): void { this.fatal = callback; }
  setLowLatency(value: boolean): void { this.lowLatency = value; }
  destroy(): void { this.destroyed = true; }
}

interface FakeVideo {
  readonly element: HTMLVideoElement;
  readonly emit: (type: string) => void;
  readonly playCalls: () => number;
  readonly loadCalls: () => number;
  readonly addTextTrack: (language: string) => TextTrack;
}

function fakeVideo(native = false, rejectPlay = false): FakeVideo {
  const listeners = new Map<string, Set<() => void>>();
  let plays = 0;
  let loads = 0;
  const tracks: TextTrack[] = [];
  const trackListeners = new Set<() => void>();
  const textTracks = Object.assign(tracks, {
    addEventListener: (_type: string, callback: () => void) => trackListeners.add(callback),
    removeEventListener: (_type: string, callback: () => void) => trackListeners.delete(callback),
  });
  const element: HTMLVideoElement = Object.assign(Object.create({}), {
    src: "",
    muted: false,
    currentTime: 5,
    videoWidth: 1920,
    videoHeight: 1080,
    textTracks,
    canPlayType: () => native ? "maybe" : "",
    play: () => {
      plays += 1;
      return rejectPlay ? Promise.reject(new DOMException("blocked", "NotAllowedError")) : Promise.resolve();
    },
    pause: () => undefined,
    load: () => { loads += 1; },
    removeAttribute: (name: string) => { if (name === "src") element.src = ""; },
    addEventListener: (type: string, callback: () => void) => {
      const rows = listeners.get(type) ?? new Set<() => void>();
      rows.add(callback);
      listeners.set(type, rows);
    },
    removeEventListener: (type: string, callback: () => void) => listeners.get(type)?.delete(callback),
  });
  return {
    element,
    emit: (type) => listeners.get(type)?.forEach((callback) => callback()),
    playCalls: () => plays,
    loadCalls: () => loads,
    addTextTrack: (language) => {
      const track: TextTrack = Object.assign(Object.create({}), { language, mode: "hidden" });
      tracks.push(track);
      trackListeners.forEach((callback) => callback());
      return track;
    },
  };
}

const preferences = {
  videoQuality: "higher" as const,
  audioLanguage: "es",
  subtitleLanguage: "en",
  lowLatency: true,
};

function harness(video: FakeVideo, supported = true) {
  const engine = new FakeEngine();
  const factory: StreamEngineFactory = { supported: () => supported, create: () => engine };
  const states: Array<{ state: StreamStageState; reason?: string }> = [];
  const facts: StreamFacts[] = [];
  const events: EventInput[] = [];
  const refusals: string[] = [];
  const controller = new StreamPlayerController(video.element, preferences, {
    onState: (state, reason) => states.push({ state, reason }),
    onFacts: (value) => facts.push(value),
    onEvent: (event) => events.push(event),
    onPlayRefused: (sentence) => refusals.push(sentence),
  }, factory);
  return { controller, engine, states, facts, events, refusals };
}

describe("StreamPlayerController", () => {
  it("attaches hls.js, applies settings and becomes ready on the first frame", () => {
    const video = fakeVideo();
    const test = harness(video);
    test.controller.attach({ url: "https://media.test/live.m3u8", autoplay: false, userInitiated: true });
    assert.equal(test.engine.attached, true);
    assert.equal(test.engine.loaded, "https://media.test/live.m3u8");
    assert.equal(video.playCalls(), 1, "a click always attempts play");
    test.engine.manifest?.();
    assert.equal(test.engine.currentLevel, 1);
    assert.equal(test.engine.audioTrack, 1);
    assert.equal(test.engine.subtitleTrack, 0);
    assert.equal(test.engine.lowLatency, true);
    video.emit("loadeddata");
    assert.equal(test.states.at(-1)?.state, "ready");
    assert.equal(test.events[0]?.identity, "media.test");
  });

  it("uses native HLS, obeys unattended autoplay and never force-mutes a refusal", async () => {
    const pausedVideo = fakeVideo(true);
    const paused = harness(pausedVideo, false);
    paused.controller.attach({ url: "https://native.test/live.m3u8", autoplay: false, userInitiated: false });
    assert.equal(pausedVideo.playCalls(), 0);
    assert.ok(pausedVideo.loadCalls() > 0);

    const refusedVideo = fakeVideo(true, true);
    const refused = harness(refusedVideo, false);
    refused.controller.attach({ url: "https://native.test/live.m3u8", autoplay: true, userInitiated: false });
    await Promise.resolve();
    assert.equal(refusedVideo.playCalls(), 1);
    assert.equal(refusedVideo.element.muted, false);
    assert.notEqual(refused.states.at(-1)?.state, "failed");
    assert.deepEqual(refused.refusals, ["Playback stayed paused because the browser refused to start it."]);
  });

  it("clears old stream facts on both a channel switch and Retry", () => {
    const video = fakeVideo();
    const test = harness(video);
    test.controller.attach({ url: "https://media.test/a.m3u8", autoplay: false, userInitiated: false });
    test.engine.manifest?.();
    assert.notDeepEqual(test.facts.at(-1), {});
    test.controller.attach({ url: "https://media.test/b.m3u8", autoplay: false, userInitiated: false });
    assert.deepEqual(test.facts.at(-1), {});
    test.controller.retry();
    assert.deepEqual(test.facts.at(-1), {});
  });

  it("applies native captions when metadata or tracks become available and removes its listener", () => {
    const video = fakeVideo(true);
    const test = harness(video, false);
    test.controller.attach({ url: "https://native.test/live.m3u8", autoplay: false, userInitiated: false });
    const english = video.addTextTrack("en");
    const spanish = video.addTextTrack("es");
    video.emit("loadedmetadata");
    assert.equal(english.mode, "showing");
    assert.equal(spanish.mode, "disabled");
    test.controller.destroy();
    const later = video.addTextTrack("en");
    assert.equal(later.mode, "hidden");
  });

  it("forwards explicit activation to the mounted player synchronously", () => {
    const attachments: string[] = [];
    const unregister = registerLiveStreamTarget({ attach: (attachment) => attachments.push(attachment.url) }, 0);
    requestLiveStream({
      url: "https://media.test/gesture.m3u8",
      autoplay: false,
      userInitiated: true,
    }, 10_000);
    assert.deepEqual(attachments, ["https://media.test/gesture.m3u8"]);
    unregister();
  });

  it("reports failures, retries the same address and destroys cleanly", () => {
    const video = fakeVideo();
    const test = harness(video);
    test.controller.attach({ url: "https://media.test/live.m3u8", autoplay: false, userInitiated: false });
    test.engine.fatal?.("The playlist failed.");
    assert.deepEqual(test.states.at(-1), { state: "failed", reason: "The playlist failed." });
    test.controller.retry();
    assert.equal(video.playCalls(), 1, "Retry is a user action");
    test.controller.detach();
    assert.equal(test.engine.destroyed, true);
    assert.equal(test.states.at(-1)?.state, "idle");
    test.controller.destroy();
  });
});
