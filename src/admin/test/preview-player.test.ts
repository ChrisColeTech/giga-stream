import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerStatus } from "@/lib/preview-state";
import { createPreviewPlayer, errorOf, type EngineError, type EngineFactory, type PreviewVideo } from "@/services/preview-player";

/** A video element as far as the player touches it, recording every call. */
class FakeVideo implements PreviewVideo {
  muted = false;
  src = "";
  calls: string[] = [];
  native = "";
  listeners = new Map<string, () => void>();
  pause(): void {
    this.calls.push("pause");
  }
  load(): void {
    this.calls.push("load");
  }
  async play(): Promise<void> {
    this.calls.push("play");
  }
  removeAttribute(name: string): void {
    this.calls.push(`remove ${name}`);
    if (name === "src") this.src = "";
  }
  canPlayType(): string {
    return this.native;
  }
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }
  fire(type: string): void {
    this.listeners.get(type)?.();
  }
}

function engines(supported: boolean) {
  const log: string[] = [];
  let fail: (error: EngineError) => void = () => undefined;
  const factory: EngineFactory<FakeVideo> = {
    supported: () => supported,
    create: () => ({
      attach: () => log.push("attach"),
      load: (url) => log.push(`load ${url}`),
      onError: (listener) => {
        fail = listener;
      },
      destroy: () => log.push("destroy"),
    }),
  };
  return { factory, log, fail: (error: EngineError) => fail(error) };
}

const rig = (supported: boolean, native = "") => {
  const video = new FakeVideo();
  video.native = native;
  const statuses: PlayerStatus[] = [];
  const hls = engines(supported);
  const player = createPreviewPlayer(video, hls.factory, (status) => statuses.push(status));
  return { video, statuses, hls, player, last: () => statuses.at(-1) };
};

describe("the Preview's player", () => {
  it("uses hls.js whenever it is supported, muted, and plays", () => {
    const { video, hls, player, last } = rig(true, "maybe");
    player.play("/live/a/master.m3u8");
    assert.deepEqual(hls.log, ["attach", "load /live/a/master.m3u8"]);
    assert.equal(video.muted, true);
    assert.equal(video.src, "", "the native source is not used beside hls.js");
    assert.deepEqual(last(), { phase: "loading", error: null });
    video.fire("playing");
    assert.deepEqual(last(), { phase: "playing", error: null });
  });

  it("falls back to the browser's own HLS only when hls.js cannot run", () => {
    const { video, hls, player } = rig(false, "maybe");
    player.play("https://tv.example/a.m3u8");
    assert.deepEqual([hls.log, video.src], [[], "https://tv.example/a.m3u8"]);
  });

  it("says the browser cannot play HLS when neither can", () => {
    const { video, player, last } = rig(false, "");
    player.play("/live/a/master.m3u8");
    assert.deepEqual(last(), { phase: "idle", error: "unsupported" });
    assert.ok(!video.calls.includes("play"));
  });

  it("maps hls.js's fatal errors: manifest failed, unreachable, media error; a non-fatal one is nothing", () => {
    const network = (details: string, fatal = true) => ({ type: "networkError", details, fatal });
    assert.equal(errorOf(network("manifestLoadError")), "manifest failed");
    assert.equal(errorOf(network("manifestLoadTimeOut")), "manifest failed");
    assert.equal(errorOf(network("manifestParsingError")), "manifest failed");
    assert.equal(errorOf(network("fragLoadError")), "unreachable");
    assert.equal(errorOf({ type: "mediaError", details: "bufferStalledError", fatal: true }), "media error");
    assert.equal(errorOf(network("fragLoadError", false)), null);
    const { hls, player, last, video } = rig(true);
    player.play("/live/a/master.m3u8");
    hls.fail(network("manifestLoadError"));
    assert.deepEqual(last(), { phase: "idle", error: "manifest failed" });
    video.fire("error");
    assert.deepEqual(last(), { phase: "idle", error: "media error" }, "the element's own error");
  });

  it("detaches: destroys the engine, pauses, removes the source and loads empty; twice is harmless", () => {
    const { video, hls, player, statuses } = rig(true);
    player.play("/live/a/master.m3u8");
    video.calls = [];
    player.detach();
    assert.deepEqual(hls.log.at(-1), "destroy");
    assert.deepEqual(video.calls, ["pause", "remove src", "load"]);
    const count = statuses.length;
    player.detach();
    assert.equal(hls.log.filter((entry) => entry === "destroy").length, 1);
    video.fire("error");
    assert.equal(statuses.length, count, "an error after detaching says nothing");
  });

  it("stops what played before playing a new address, and lets go of the element when disposed", () => {
    const { video, hls, player } = rig(true);
    player.play("/live/a/master.m3u8");
    player.play("/live/a/master.m3u8");
    assert.deepEqual(hls.log, ["attach", "load /live/a/master.m3u8", "destroy", "attach", "load /live/a/master.m3u8"]);
    player.dispose();
    assert.equal(video.listeners.size, 0);
  });
});
