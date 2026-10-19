import { removeDir } from "./db-kit.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildApp } from "../src/app.js";
import { config } from "../src/config.js";
import { isPrivateRoute, startRefusal } from "../src/network-policy.js";
import { JWT_SECRET, makeApp, send } from "./test-app.js";

const base = { ...config, JWT_SECRET, HOST: "127.0.0.1", TLS_CERT_FILE: "", TLS_KEY_FILE: "", TRUST_PROXY: false, ALLOW_INSECURE_HTTP: false };

test("loopback over plain http is allowed", () => {
  assert.equal(startRefusal(base), undefined);
  assert.equal(startRefusal({ ...base, HOST: "localhost" }), undefined);
});

test("off loopback, plain http is refused unless TLS, a trusted proxy or the development override is set", () => {
  assert.match(startRefusal({ ...base, HOST: "0.0.0.0" }) ?? "", /TLS_CERT_FILE.*TRUST_PROXY.*ALLOW_INSECURE_HTTP/s);
  assert.equal(startRefusal({ ...base, HOST: "0.0.0.0", TLS_CERT_FILE: "c.pem", TLS_KEY_FILE: "k.pem" }), undefined);
  assert.equal(startRefusal({ ...base, HOST: "0.0.0.0", TRUST_PROXY: true }), undefined);
  assert.equal(startRefusal({ ...base, HOST: "192.168.1.20", ALLOW_INSECURE_HTTP: true }), undefined);
});

test("a certificate without its key, or a short JWT secret, is refused", () => {
  assert.match(startRefusal({ ...base, TLS_CERT_FILE: "c.pem" }) ?? "", /together/);
  assert.match(startRefusal({ ...base, JWT_SECRET: "short" }) ?? "", /JWT_SECRET/);
});

test("a refused start creates no database file", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-net-"));
  try {
    await assert.rejects(buildApp({ ...base, NODE_ENV: "test", DATA_DIR: dataDir, HOST: "0.0.0.0" }), /plain http/);
    assert.deepEqual(readdirSync(dataDir), []);
  } finally {
    removeDir(dataDir);
  }
});

test("sign-in, account and audit answers are never cached; channel reads may be", () => {
  for (const url of ["/api/admin/auth/login", "/api/admin/auth/me", "/api/admin/accounts", "/api/admin/accounts/x", "/api/admin/audit?limit=5", "/api/admin/channels",
    "/api/admin/channels?limit=100", "/api/admin/titles/stored", "/api/admin/titles/stored?limit=100", "/api/admin/titles/sync", "/api/admin/titles/deleted",
    "/api/admin/providers", "/api/admin/jobs", "/api/admin/playlists", "/api/admin/live-faults/x/fault"]) {
    assert.equal(isPrivateRoute(url), true, url);
  }
  for (const url of ["/api/channels", "/api/titles?kind=movie", "/healthz", "/apix", "/live/home/master.m3u8", "/admin/"]) {
    assert.equal(isPrivateRoute(url), false, url);
  }
});

test("a browser page on another origin may call the backend only when CORS_ORIGINS lists it", async () => {
  const open = await makeApp({ config: { CORS_ORIGINS: "https://admin.example.test" } });
  const listed = await open.app.inject({ method: "GET", url: "/api/channels", headers: { origin: "https://admin.example.test" } });
  assert.equal(listed.headers["access-control-allow-origin"], "https://admin.example.test");
  const other = await open.app.inject({ method: "GET", url: "/api/channels", headers: { origin: "https://evil.example.test" } });
  assert.equal(other.headers["access-control-allow-origin"], undefined);

  const closed = await makeApp();
  const answer = await closed.app.inject({ method: "GET", url: "/api/channels", headers: { origin: "https://admin.example.test" } });
  assert.equal(answer.headers["access-control-allow-origin"], undefined);
  assert.equal((await send(closed.app, "GET", "/api/channels")).status, 200);
});
