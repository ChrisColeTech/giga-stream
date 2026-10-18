// The guarded outbound function over a real socket: a local node:http server on 127.0.0.1 (allowLoopback) and the
// real node transport. No public internet.
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createSafeFetch, SafeFetchError } from "../src/services/safe-fetch.js";

interface Harness {
  base: string;
  closed: { stream: boolean };
  stop: () => Promise<void>;
}

async function startServer(): Promise<Harness> {
  const closed = { stream: false };
  const server = http.createServer((req, res) => {
    const path = req.url ?? "";
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (path === "/r1") return void res.writeHead(302, { Location: "/r2" }).end();
    if (path === "/r2") return void res.writeHead(301, { Location: `${base}/ok` }).end();
    if (path === "/loop") return void res.writeHead(307, { Location: "/loop" }).end();
    if (path === "/ok") return void res.writeHead(200, { "Content-Type": "text/plain" }).end("hello");
    if (path === "/echo") return void res.writeHead(200).end(JSON.stringify(req.headers));
    if (path === "/big") return void res.writeHead(200).end(Buffer.alloc(5_000, 7));
    if (path === "/stream") {
      res.on("close", () => (closed.stream = true));
      res.writeHead(200);
      const timer = setInterval(() => res.write(Buffer.alloc(512, 1)), 5);
      res.on("close", () => clearInterval(timer));
      return;
    }
    if (path === "/slow") {
      res.writeHead(200);
      res.write("start");
      return; // never ends
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    closed,
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SafeFetchError, String(error));
    return error.code;
  }
  return "no error";
}

test("over a real socket: redirects, caps, prefix, headers and the slow-body timeout", async () => {
  const server = await startServer();
  try {
    const safe = createSafeFetch({ allowLoopback: true });

    const chain = await safe(`${server.base}/r1`, { timeoutMs: 2_000, maxBytes: 100 });
    assert.deepEqual([chain.status, chain.body.toString(), chain.url], [200, "hello", `${server.base}/ok`]);
    assert.equal(chain.headers["content-type"], "text/plain");

    assert.equal(await codeOf(safe(`${server.base}/loop`, { timeoutMs: 2_000, maxBytes: 100 })), "safe_fetch.too_many_redirects");

    assert.equal(await codeOf(safe(`${server.base}/big`, { timeoutMs: 2_000, maxBytes: 1_000 })), "safe_fetch.too_large");
    const whole = await safe(`${server.base}/big`, { timeoutMs: 2_000, maxBytes: 5_000 });
    assert.deepEqual([whole.body.length, whole.truncated], [5_000, false]);

    const prefix = await safe(`${server.base}/stream`, { timeoutMs: 2_000, prefixBytes: 1_000 });
    assert.deepEqual([prefix.body.length, prefix.truncated], [1_000, true]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(server.closed.stream, true, "the socket is destroyed after the prefix");

    const echoed = await safe(`${server.base}/echo`, {
      timeoutMs: 2_000,
      maxBytes: 4_000,
      headers: { Cookie: "a=b", "Accept-Encoding": "gzip" },
    });
    const seen = JSON.parse(echoed.body.toString()) as Record<string, string>;
    assert.deepEqual([seen["accept-encoding"], seen["connection"], seen["cookie"]], ["identity", "close", undefined]);
    assert.match(seen["user-agent"] ?? "", /^GigaStream\//);

    const started = Date.now();
    assert.equal(await codeOf(safe(`${server.base}/slow`, { timeoutMs: 150, maxBytes: 1_000 })), "safe_fetch.timeout");
    assert.ok(Date.now() - started < 1_500);

    const controller = new AbortController();
    const pending = safe(`${server.base}/slow`, { timeoutMs: 5_000, maxBytes: 1_000, signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    assert.equal(await codeOf(pending), "safe_fetch.aborted");
  } finally {
    await server.stop();
  }
});

test("over a real socket: the lookup hook pins a validated address and refuses the rest", async () => {
  const server = await startServer();
  try {
    const port = new URL(server.base).port;
    const pinned = createSafeFetch({
      allowLoopback: true,
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    const viaName = await pinned(`http://localhost:${port}/ok`, { timeoutMs: 2_000, maxBytes: 100 });
    assert.equal(viaName.body.toString(), "hello");

    const strict = createSafeFetch({ lookup: async () => [{ address: "127.0.0.1", family: 4 }] });
    const options = { timeoutMs: 2_000, maxBytes: 100 };
    assert.equal(await codeOf(strict(`http://127.0.0.1:${port}/ok`, options)), "safe_fetch.blocked_address");
    assert.equal(await codeOf(strict(`https://127.0.0.1:${port}/ok`, options)), "safe_fetch.blocked_address");
    assert.equal(await codeOf(strict(`https://rebind.example:${port}/ok`, options)), "safe_fetch.blocked_address");

    const mixed = createSafeFetch({
      allowLoopback: true,
      lookup: async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ],
    });
    assert.equal(await codeOf(mixed(`http://localhost:${port}/ok`, options)), "safe_fetch.blocked_address");
  } finally {
    await server.stop();
  }
});
