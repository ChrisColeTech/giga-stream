import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mountEmbedLifecycle } from "@/lib/embed-lifecycle";
import { decodeAllowedEmbedMessage } from "@/lib/embed-messages";
import { embedFramePolicy, stopEmbed } from "@/lib/embed-policy";
import { applyEmbedPlayback } from "@/lib/embed-playback";
import { embedUrl } from "@/lib/embed-url";
import { clearPlayerPolicy, setPlayerPolicy, type PlayerPolicyCapability } from "@/services/player-policy";
import type { TitleSource } from "@/services/schemas/source-schema";

const source: TitleSource = {
  providerId: 7,
  name: "Provider",
  url: "https://player.example/embed/603?theme=dark",
  origin: "https://player.example",
  order: 1,
  startParam: "startAt",
  subtitlesParam: "ds_lang",
  frameOrigins: ["https://player.example"],
  messageShape: "player-event",
};

describe("provider embed address and runtime policy", () => {
  it("adds integer resume seconds and subtitle language without losing existing parameters", () => {
    const url = new URL(embedUrl(source, 305_900, "en-US"));
    assert.equal(url.searchParams.get("theme"), "dark");
    assert.equal(url.searchParams.get("startAt"), "305");
    assert.equal(url.searchParams.get("ds_lang"), "en-US");
  });

  it("omits iframe sandbox in both runtimes while preserving permissions and referrer policy", () => {
    assert.equal(Object.hasOwn(embedFramePolicy(), "sandbox"), false);
    assert.equal(embedFramePolicy().referrerPolicy, "origin");
    assert.equal(embedFramePolicy().allow, "autoplay; fullscreen; encrypted-media; picture-in-picture");
  });

  it("sets and clears only the named Electron player policy capability", () => {
    const calls: string[] = [];
    const capability: PlayerPolicyCapability = {
      runtime: "electron",
      setPlayerPolicy: (policy) => calls.push(`set:${policy.origin}:${policy.frameOrigins.join(",")}`),
      clearPlayerPolicy: () => calls.push("clear"),
    };
    assert.equal(setPlayerPolicy({ origin: source.origin, frameOrigins: source.frameOrigins ?? [] }, null), false);
    assert.equal(setPlayerPolicy({ origin: source.origin, frameOrigins: source.frameOrigins ?? [] }, capability), true);
    clearPlayerPolicy(capability);
    assert.deepEqual(calls, ["set:https://player.example:https://player.example", "clear"]);
  });

  it("blank-stops the old frame; React owns the node's removal via the host key", () => {
    const frame = { src: "https://player.example" };
    stopEmbed(frame);
    assert.equal(frame.src, "about:blank");
  });

  it("removes the old listener and blanks the old frame before the next authority is installed", () => {
    const calls: string[] = [];
    let listener: ((event: MessageEvent<unknown>) => void) | undefined;
    const target = {
      addEventListener: (_type: "message", next: (event: MessageEvent<unknown>) => void) => {
        calls.push("listen-old"); listener = next;
      },
      removeEventListener: (_type: "message", current: (event: MessageEvent<unknown>) => void) => {
        assert.equal(current, listener); calls.push("unlisten-old");
      },
    };
    const old = { src: source.url, contentWindow: null };
    const dispose = mountEmbedLifecycle(old, source, target, () => undefined, () => calls.push("clear-old"));
    dispose();
    calls.push("set-new");
    assert.equal(old.src, "about:blank");
    assert.deepEqual(calls, ["listen-old", "unlisten-old", "clear-old", "set-new"]);
  });
});

describe("provider message decoding", () => {
  it("decodes common and observed VixSrc event objects from seconds to milliseconds", () => {
    const common = decodeAllowedEmbedMessage(source, source.origin, true, {
      type: "PLAYER_EVENT", data: { event: "timeupdate", currentTime: 2.25, duration: 9.5 },
    });
    const observed = decodeAllowedEmbedMessage(source, source.origin, true, JSON.stringify({
      type: "PLAYER_EVENT", event: { event: "pause", currentTime: 3, duration: 10 },
    }));
    assert.deepEqual(common, { event: "timeupdate", positionMs: 2250, durationMs: 9500 });
    assert.deepEqual(observed, { event: "pause", positionMs: 3000, durationMs: 10000 });
  });

  it("decodes vidsrc-status and MEDIA_DATA, and ignores foreign, non-frame, and malformed messages", () => {
    const vidsrc = { ...source, messageShape: "vidsrc-status" as const };
    assert.deepEqual(decodeAllowedEmbedMessage(vidsrc, vidsrc.origin, true, {
      type: "PLAYER_EVENT",
      data: { player_status: "playing", player_progress: 4.5, player_duration: 20 },
    }), { event: "playing", positionMs: 4500, durationMs: 20000 });
    assert.deepEqual(decodeAllowedEmbedMessage(source, source.origin, true, {
      type: "MEDIA_DATA", data: { currentTime: 6, duration: 30 },
    }), { event: "media-data", positionMs: 6000, durationMs: 30000 });
    assert.equal(decodeAllowedEmbedMessage(vidsrc, vidsrc.origin, true, {
      type: "PLAYER_EVENT", event: { event: "pause", currentTime: 3, duration: 10 },
    }), null);
    assert.equal(decodeAllowedEmbedMessage(vidsrc, vidsrc.origin, true, {
      type: "MEDIA_DATA", data: { currentTime: 6, duration: 30 },
    }), null);
    assert.equal(decodeAllowedEmbedMessage(source, source.origin, true, {
      type: "PLAYER_EVENT", data: { player_status: "playing", player_progress: 4, player_duration: 20 },
    }), null);
    assert.equal(decodeAllowedEmbedMessage({ ...source, messageShape: undefined }, source.origin, true, {
      type: "PLAYER_EVENT", data: { event: "timeupdate", currentTime: 2, duration: 10 },
    }), null);
    assert.equal(decodeAllowedEmbedMessage(source, "https://foreign.example", true, {}), null);
    assert.equal(decodeAllowedEmbedMessage(source, source.origin, false, {}), null);
    assert.equal(decodeAllowedEmbedMessage(source, source.origin, true, "not-json"), null);
  });

  it("stops the active cadence before checkpointing an embed end", () => {
    const calls: string[] = [];
    applyEmbedPlayback({ event: "ended", positionMs: 10_000 }, {
      progress: () => calls.push("progress"),
      paused: () => calls.push("paused"),
      playing: () => calls.push("stop"),
      checkpoint: () => calls.push("checkpoint"),
    });
    assert.deepEqual(calls, ["progress", "paused", "stop", "checkpoint"]);
  });
});
