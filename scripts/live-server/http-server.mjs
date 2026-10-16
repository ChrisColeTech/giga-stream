import http from "node:http";

import { handleControl } from "./control-routes.mjs";
import { corsHeaders, sendBuffer, sendJson } from "./http-response.mjs";
import { logoPng } from "./logo-png.mjs";
import { PLAYLIST_CACHE, SEGMENT_CACHE, isPlaylist, mimeOf } from "./mime-types.mjs";

const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RAW_TRAVERSAL = /\.\.|%2e|%2f|%5c|\\|\0|%00/i;
const sleepFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The live stream HTTP server (docs/10 section 3.1), `node:http` only. `channels` maps a channel id
 * to { channel, backend }; a backend is `{ mode, state(), renditions(), read(parts) }` and answers
 * the same way for encode mode (files on disk) and loop mode (computed). `faults` is a
 * fault-state. `testPage` is an HTML string served at /test/player.html when given.
 * Returns an http.Server that is not yet listening.
 */
export function createHttpServer({ mode, channels, faults, sleep = sleepFor, testPage = null }) {
  function listChannels(req, res) {
    const base = `http://${req.headers.host ?? "127.0.0.1"}`;
    const entries = [...channels.values()].map(({ channel, backend }) => ({
      id: channel.id,
      name: channel.name,
      number: channel.number,
      category: channel.category,
      mode: backend.mode,
      masterUrl: `${base}/live/${channel.id}/master.m3u8`,
      logoUrl: `${base}/logos/${channel.id}.png`,
      state: backend.state(),
      fault: faults.describe(channel.id)?.fault ?? null,
      renditions: backend.renditions(),
    }));
    sendJson(req, res, 200, { channels: entries });
  }

  async function serveLive(req, res, channelId, parts) {
    const entry = channels.get(channelId);
    if (!entry) return sendJson(req, res, 404, { error: "channel.not_found" });
    if (parts.length < 1 || parts.length > 2 || !parts.every((part) => SAFE_PART.test(part))) {
      return sendJson(req, res, 400, { error: "path.invalid" });
    }
    const file = parts.at(-1);
    const isMaster = parts.length === 1 && file === "master.m3u8";
    const playlist = isPlaylist(file);
    if (!playlist) {
      const decision = faults.segment(channelId);
      if (decision.delayMs > 0) await sleep(decision.delayMs);
      if (decision.status !== 200) return sendJson(req, res, decision.status, { error: "segment.not_found" });
    }
    const bytes = await entry.backend.read(parts);
    if (bytes === null) return sendJson(req, res, 404, { error: "media.not_found" });
    let body = bytes;
    if (playlist && !isMaster) {
      const outcome = faults.playlist(channelId, parts.join("/"), bytes.toString("utf-8"));
      if (outcome.status !== 200) return sendJson(req, res, outcome.status, { error: "playlist.unavailable" });
      body = Buffer.from(outcome.body);
    }
    return sendBuffer(req, res, body, {
      "content-type": mimeOf(file),
      "cache-control": playlist ? PLAYLIST_CACHE : SEGMENT_CACHE,
    });
  }

  async function route(req, res, parts) {
    const [head, second, ...rest] = parts;
    if (head === "control" && parts.length === 3) {
      return handleControl(req, res, { channelId: second, action: rest[0], channels, faults });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return sendJson(req, res, 405, { error: "method.not_allowed" });
    if (head === "healthz" && parts.length === 1) {
      return sendJson(req, res, 200, { ok: true, mode, channels: channels.size });
    }
    if (head === "channels.json" && parts.length === 1) return listChannels(req, res);
    if (head === "live" && parts.length >= 3) return serveLive(req, res, second, parts.slice(2));
    if (head === "logos" && parts.length === 2 && /^[a-z0-9-]+\.png$/.test(second)) {
      const id = second.slice(0, -4);
      if (!channels.has(id)) return sendJson(req, res, 404, { error: "channel.not_found" });
      return sendBuffer(req, res, logoPng(id), { "content-type": "image/png", "cache-control": SEGMENT_CACHE });
    }
    if (testPage !== null && head === "test" && second === "player.html" && parts.length === 2) {
      return sendBuffer(req, res, Buffer.from(testPage), { "content-type": mimeOf("x.html"), "cache-control": "no-store" });
    }
    return sendJson(req, res, 404, { error: "route.not_found" });
  }

  return http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders(req));
        return void res.end();
      }
      const rawPath = (req.url ?? "/").split("?")[0];
      if (RAW_TRAVERSAL.test(rawPath)) return sendJson(req, res, 400, { error: "path.invalid" });
      const parts = rawPath.split("/").filter((part) => part !== "").map(decodeURIComponent);
      return await route(req, res, parts);
    } catch (error) {
      if (error instanceof URIError) sendJson(req, res, 400, { error: "path.invalid" });
      else if (!res.headersSent) sendJson(req, res, 500, { error: "server.error", message: String(error.message) });
      else res.destroy();
      return undefined;
    }
  });
}
