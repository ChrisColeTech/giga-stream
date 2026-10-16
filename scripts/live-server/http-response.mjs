const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** CORS headers: a loopback origin is echoed back; any other origin gets none. */
export function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = { vary: "origin" };
  if (typeof origin === "string" && LOOPBACK_ORIGIN.test(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, HEAD, POST, OPTIONS";
    headers["access-control-allow-headers"] = "range, content-type";
    headers["access-control-expose-headers"] = "content-length, content-range, accept-ranges";
  }
  return headers;
}

/**
 * A single byte range for a body of `size` bytes: null when there is no usable Range header (serve
 * everything), "unsatisfiable" when it lies outside the body, else { start, end } inclusive.
 */
export function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(typeof header === "string" ? header.trim() : "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start;
  let end;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start >= size || start > end ? "unsatisfiable" : { start, end };
}

/** Sends a buffer with HEAD and Range handling. `extra` adds headers (cache-control, content-type). */
export function sendBuffer(req, res, body, headers) {
  const all = { ...corsHeaders(req), "accept-ranges": "bytes", ...headers };
  const range = parseRange(req.headers.range, body.length);
  if (range === "unsatisfiable") {
    res.writeHead(416, { ...all, "content-range": `bytes */${body.length}`, "content-length": 0 });
    res.end();
    return;
  }
  const slice = range ? body.subarray(range.start, range.end + 1) : body;
  const status = range ? 206 : 200;
  if (range) all["content-range"] = `bytes ${range.start}-${range.end}/${body.length}`;
  res.writeHead(status, { ...all, "content-length": slice.length });
  res.end(req.method === "HEAD" ? undefined : slice);
}

/** Sends a JSON document (no Range: control and listing answers are tiny). */
export function sendJson(req, res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    ...corsHeaders(req),
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": body.length,
  });
  res.end(req.method === "HEAD" ? undefined : body);
}
