import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeAllowedEmbedMessage } from "@/lib/embed-messages";
import { embedFramePolicy, stopEmbed } from "@/lib/embed-policy";
import { embedUrl } from "@/lib/embed-url";
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

  it("sandboxes and labels the browser lane, but leaves Electron unsandboxed", () => {
    assert.equal(embedFramePolicy(false).sandbox, "allow-scripts allow-same-origin allow-presentation");
    assert.equal(embedFramePolicy(false).referrerPolicy, "origin");
    assert.equal(embedFramePolicy(true).sandbox, undefined);
  });

  it("blank-stops and removes the old frame before another source is hosted", () => {
    const calls: string[] = [];
    const frame = { src: "https://player.example", remove: () => calls.push("removed") };
    stopEmbed(frame);
    assert.equal(frame.src, "about:blank");
    assert.deepEqual(calls, ["removed"]);
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
    assert.equal(decodeAllowedEmbedMessage(source, "https://foreign.example", true, {}), null);
    assert.equal(decodeAllowedEmbedMessage(source, source.origin, false, {}), null);
    assert.equal(decodeAllowedEmbedMessage(source, source.origin, true, "not-json"), null);
  });
});
