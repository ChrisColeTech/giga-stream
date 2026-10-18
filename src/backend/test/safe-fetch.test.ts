// The guarded outbound function (docs/43 section 3.8) with an injected resolver and transport: no sockets.
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { SAFE_FETCH_USER_AGENT } from "../src/constants/limits.js";
import { isBlockedAddress } from "../src/services/address-ranges.js";
import { createSafeFetch, SafeFetchError, type SafeTransport, type TransportRequest } from "../src/services/safe-fetch.js";
import { createGuardedLookup } from "../src/services/safe-fetch-transport.js";

const PUBLIC = [{ address: "93.184.216.34", family: 4 as const }];

function reply(status: number, body: string | Readable = "", headers: Record<string, string> = {}) {
  return { status, headers, body: typeof body === "string" ? Readable.from([Buffer.from(body)]) : body };
}

/** A transport answering from `replies` by URL; remembers every request. */
function fakeTransport(replies: Record<string, () => ReturnType<typeof reply>>) {
  const seen: TransportRequest[] = [];
  const transport: SafeTransport = async (request) => {
    seen.push(request);
    const make = replies[request.url.href];
    if (make === undefined) throw new Error("unexpected " + request.url.href);
    return make();
  };
  return { transport, seen };
}

const run = (url: string, extra: object = {}) => ({ url, options: { timeoutMs: 1_000, maxBytes: 100, ...extra } });

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SafeFetchError, String(error));
    return error.code;
  }
  return "no error";
}

test("every refused range is blocked and a public address is not", () => {
  const blocked = [
    "0.1.2.3", "10.1.2.3", "100.64.0.1", "100.127.255.254", "127.0.0.1", "127.9.9.9", "169.254.169.254",
    "172.16.0.1", "172.31.255.255", "192.0.0.8", "192.0.2.5", "192.168.1.1", "198.18.0.1", "198.19.255.255",
    "198.51.100.7", "203.0.113.9", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "64:ff9b::192.168.0.1", "2002:a00:1::1",
    "2002:7f00:1::", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "2001:db8::1", "fc00::1", "fd12:3456::1",
    "fe80::1", "febf::1", "fec0::1", "ff02::1", "not-an-ip",
  ];
  for (const address of blocked) assert.equal(isBlockedAddress(address), true, address);
  const allowed = ["93.184.216.34", "8.8.8.8", "100.63.255.255", "172.32.0.1", "198.20.0.1", "1.1.1.1"];
  for (const address of [...allowed, "2606:4700:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("allowLoopback permits only 127/8 and ::1", () => {
  assert.equal(isBlockedAddress("127.0.0.1", true), false);
  assert.equal(isBlockedAddress("127.5.5.5", true), false);
  assert.equal(isBlockedAddress("::1", true), false);
  for (const address of ["10.0.0.1", "169.254.169.254", "::", "fe80::1", "::ffff:127.0.0.1", "0.0.0.0"]) {
    assert.equal(isBlockedAddress(address, true), true, address);
  }
});

test("the lookup hook serves both callback forms and refuses a private or mixed answer", async () => {
  const guard = (answer: Array<{ address: string; family: 4 | 6 }>) => createGuardedLookup(async () => answer, false);
  const call = (lookup: ReturnType<typeof guard>, all: boolean) =>
    new Promise<{ error: Error | null; address: unknown; family: unknown }>((resolve) => {
      lookup("cdn.example", { all }, (error, address, family) => resolve({ error, address, family }));
    });
  const ok = await call(guard(PUBLIC), false);
  assert.deepEqual([ok.error, ok.address, ok.family], [null, "93.184.216.34", 4]);
  const all = await call(guard(PUBLIC), true);
  assert.deepEqual([all.error, all.address], [null, PUBLIC]);
  const bads = [[{ address: "10.0.0.5", family: 4 as const }], [...PUBLIC, { address: "127.0.0.1", family: 4 as const }], []];
  for (const answer of bads) {
    for (const wantAll of [false, true]) {
      const refused = await call(guard(answer), wantAll);
      assert.ok(refused.error instanceof SafeFetchError);
      assert.equal(refused.error.code, "safe_fetch.blocked_address");
      assert.equal(refused.error.host, "cdn.example");
    }
  }
  const failing = createGuardedLookup(async () => Promise.reject(new Error("secret upstream text")), false);
  const failed = await call(failing, false);
  assert.ok(failed.error instanceof SafeFetchError);
  assert.equal(failed.error.code, "safe_fetch.failed");
  assert.ok(!failed.error.message.includes("secret"));
});

test("URLs: only https, no userinfo, IP literals checked directly without a lookup", async () => {
  const { transport, seen } = fakeTransport({});
  let lookups = 0;
  const safe = createSafeFetch({ transport, lookup: async () => (lookups++, PUBLIC) });
  const cases: Array<[string, string]> = [
    ["not a url", "safe_fetch.bad_url"],
    ["http://cdn.example/a", "safe_fetch.bad_url"],
    ["ftp://cdn.example/a", "safe_fetch.bad_url"],
    ["https://user:pw@cdn.example/a", "safe_fetch.bad_url"],
    ["https://user@cdn.example/a", "safe_fetch.bad_url"],
    ["https://10.0.0.1/a", "safe_fetch.blocked_address"],
    ["https://[::1]/a", "safe_fetch.blocked_address"],
    ["https://[::ffff:192.168.1.1]/a", "safe_fetch.blocked_address"],
    ["https://169.254.169.254/latest/meta-data", "safe_fetch.blocked_address"],
  ];
  for (const [url, code] of cases) assert.equal(await codeOf(safe(url, run(url).options)), code, url);
  assert.equal(seen.length, 0);
  assert.equal(lookups, 0);
});

test("errors carry the host only, never the URL or query", async () => {
  const safe = createSafeFetch({ transport: fakeTransport({}).transport });
  try {
    await safe("https://10.0.0.1/path?token=SECRET", run("x").options);
    assert.fail("should refuse");
  } catch (error) {
    assert.ok(error instanceof SafeFetchError);
    assert.equal(error.host, "10.0.0.1");
    assert.ok(!JSON.stringify([error.message, error.host]).includes("SECRET"));
  }
});

test("redirects: relative Location, hop cap, private target, https to http, userinfo", async () => {
  const hop = (to: string) => () => reply(302, "", { location: to });
  const { transport, seen } = fakeTransport({
    "https://a.example/start": hop("/next?x=1"),
    "https://a.example/next?x=1": hop("https://b.example/end"),
    "https://b.example/end": () => reply(200, "done", { "Content-Type": "text/plain" }),
    "https://a.example/loop": hop("/loop"),
    "https://a.example/priv": hop("https://192.168.0.9/x"),
    "https://a.example/down": hop("http://b.example/x"),
    "https://a.example/cred": hop("https://u:p@b.example/x"),
  });
  const safe = createSafeFetch({ transport, lookup: async () => PUBLIC });
  const done = await safe("https://a.example/start", run("x").options);
  assert.deepEqual([done.status, done.url, done.body.toString(), done.headers["content-type"]], [
    200, "https://b.example/end", "done", "text/plain",
  ]);
  assert.equal(seen.length, 3);
  const codes = async (path: string, extra: object = {}) =>
    codeOf(safe(`https://a.example/${path}`, run("x", extra).options));
  assert.equal(await codes("loop"), "safe_fetch.too_many_redirects");
  assert.equal(await codes("loop", { maxRedirects: 0 }), "safe_fetch.too_many_redirects");
  assert.equal(await codes("priv"), "safe_fetch.blocked_address");
  assert.equal(await codes("down"), "safe_fetch.redirect_refused");
  assert.equal(await codes("cred"), "safe_fetch.redirect_refused");
});

test("byte cap throws too_large; prefixBytes stops with truncated and destroys the stream", async () => {
  const big = () => reply(200, "x".repeat(300));
  const { transport } = fakeTransport({ "https://a.example/big": big, "https://a.example/small": () => reply(200, "ok") });
  const safe = createSafeFetch({ transport, lookup: async () => PUBLIC });
  assert.equal(await codeOf(safe("https://a.example/big", { timeoutMs: 1_000, maxBytes: 100 })), "safe_fetch.too_large");
  const small = await safe("https://a.example/small", { timeoutMs: 1_000, maxBytes: 100 });
  assert.deepEqual([small.body.toString(), small.truncated], ["ok", false]);
  const stream = new Readable({ read() { this.push(Buffer.alloc(40, 1)); } });
  const cut = createSafeFetch({ transport: async () => ({ status: 200, headers: {}, body: stream }), lookup: async () => PUBLIC });
  const prefix = await cut("https://a.example/live", { timeoutMs: 1_000, prefixBytes: 100 });
  assert.deepEqual([prefix.body.length, prefix.truncated], [100, true]);
  assert.equal(stream.destroyed, true);
});

test("timeout and abort reject with their codes and destroy the request", async () => {
  let signalSeen: AbortSignal | undefined;
  const hanging: SafeTransport = (request) =>
    new Promise((_resolve, reject) => {
      signalSeen = request.signal;
      request.signal.addEventListener("abort", () => reject(new Error("socket destroyed")));
    });
  const safe = createSafeFetch({ transport: hanging, lookup: async () => PUBLIC });
  assert.equal(await codeOf(safe("https://a.example/", { timeoutMs: 30, maxBytes: 10 })), "safe_fetch.timeout");
  assert.equal(signalSeen?.aborted, true);
  const controller = new AbortController();
  const pending = safe("https://a.example/", { timeoutMs: 5_000, maxBytes: 10, signal: controller.signal });
  controller.abort();
  assert.equal(await codeOf(pending), "safe_fetch.aborted");
  assert.equal(await codeOf(safe("https://a.example/", { timeoutMs: 5_000, maxBytes: 10, signal: controller.signal })), "safe_fetch.aborted");
  const slow = new Readable({ read() {} });
  const mid = createSafeFetch({ transport: async () => ({ status: 200, headers: {}, body: slow }), lookup: async () => PUBLIC });
  assert.equal(await codeOf(mid("https://a.example/", { timeoutMs: 30, maxBytes: 10 })), "safe_fetch.timeout");
  assert.equal(slow.destroyed, true);
});

test("request headers: identity, close, fixed User-Agent, no cookies, no Host override", async () => {
  const { transport, seen } = fakeTransport({
    "https://a.example/x": () => reply(200, "k"),
    "https://a.example/y": () => reply(302, "", { location: "https://b.example/z" }),
    "https://b.example/z": () => reply(200, "k"),
  });
  const safe = createSafeFetch({ transport, lookup: async () => PUBLIC });
  const headers = { Cookie: "a=b", cookie2: "c", Host: "evil", "user-agent": "x", "Accept-Encoding": "gzip", Accept: "*/*" };
  await safe("https://a.example/x", { timeoutMs: 1_000, maxBytes: 10, headers });
  assert.deepEqual(seen[0]?.headers, {
    Accept: "*/*",
    "Accept-Encoding": "identity",
    Connection: "close",
    "User-Agent": SAFE_FETCH_USER_AGENT,
  });
  await safe("https://a.example/y", { timeoutMs: 1_000, maxBytes: 10, headers: { Authorization: "Bearer t" } });
  assert.equal(seen[1]?.headers["Authorization"], "Bearer t");
  assert.equal(seen[2]?.headers["Authorization"], undefined);
  const head = await safe("https://a.example/x", { timeoutMs: 1_000, maxBytes: 10, method: "HEAD" });
  assert.equal(head.body.length, 0);
  assert.equal(seen[3]?.method, "HEAD");
});
