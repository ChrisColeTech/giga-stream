import assert from "node:assert/strict";
import { describe, it } from "node:test";
import config, { portOf } from "../vite.config.mts";

/* The development proxy (the Channels wave's fix): the backend is the PORT of `src/backend/.env`, then `dev.env`, then
 * 8091, and the Preview's `/live`, the logos and `/healthz` are forwarded beside `/api`. */
describe("the admin's development proxy", () => {
  it("takes only the PORT line of an env file", () => {
    assert.equal(portOf("JWT_SECRET=abc\nPORT=3001\nADMIN_PORT=9\n"), "3001");
    assert.equal(portOf('PORT = "8091"\n'), "8091");
    assert.equal(portOf("ADMIN_PORT=9\n# PORT=1\nDATA_DIR=x\n"), undefined);
  });

  it("forwards /api, /live, /logos, /test and /healthz to one backend", () => {
    if (typeof config !== "function") throw new Error("the config is a function of the mode");
    const resolved = config({ mode: "test", command: "serve", isSsrBuild: false, isPreview: false });
    if (resolved instanceof Promise) throw new Error("the config is synchronous");
    const proxy = resolved.server?.proxy ?? {};
    assert.deepEqual(Object.keys(proxy).sort(), ["/api", "/healthz", "/live", "/logos", "/test"]);
    const targets = new Set(Object.values(proxy).map((entry) => (typeof entry === "string" ? entry : entry.target)));
    assert.equal(targets.size, 1);
    assert.match(String([...targets][0]), /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.deepEqual(Object.keys(resolved.preview?.proxy ?? {}).sort(), Object.keys(proxy).sort());
  });
});
