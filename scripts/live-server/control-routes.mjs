import { sendJson } from "./http-response.mjs";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const BODY_LIMIT = 4096;

/** True when the TCP peer is the loopback interface. */
export function isLoopbackPeer(req) {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? "");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let text = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk) => {
      text += chunk;
      if (text.length > BODY_LIMIT) {
        reject(new Error("body.too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (text.trim() === "") return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("body.invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * POST /control/:channelId/fault with { fault, durationMs?, delayMs? } and
 * POST /control/:channelId/clear. Loopback peers only; always JSON answers.
 */
export async function handleControl(req, res, { channelId, action, channels, faults }) {
  if (!isLoopbackPeer(req)) return sendJson(req, res, 403, { error: "control.loopback_only" });
  if (req.method !== "POST") return sendJson(req, res, 405, { error: "method.not_allowed" });
  if (!channels.has(channelId)) return sendJson(req, res, 404, { error: "channel.not_found" });
  if (action === "clear") {
    faults.clear(channelId);
    return sendJson(req, res, 200, { ok: true, channelId, fault: null });
  }
  if (action !== "fault") return sendJson(req, res, 404, { error: "route.not_found" });
  let body;
  try {
    body = await readJsonBody(req);
    faults.set(channelId, body ?? {});
  } catch (error) {
    const code = String(error.message).split(":")[0];
    return sendJson(req, res, 400, { error: code, message: error.message });
  }
  return sendJson(req, res, 200, { ok: true, channelId, fault: faults.describe(channelId) });
}
