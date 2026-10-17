import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { chooseFolder, hasDesktopPicker } from "@/services/desktop";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("desktop folder picker", () => {
  it("refuses the browser without making a request", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response();
    };
    assert.equal(hasDesktopPicker(null), false);
    await assert.rejects(chooseFolder(null), { code: "fs.desktop_required", status: 409 });
    assert.equal(called, false);
  });

  it("uses the named preload capability seam and returns only token and name", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/fs/dialog");
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ ok: true, data: { token: "opaque", name: "Films" } }));
    };
    const capability = { runtime: "electron" } as const;
    assert.equal(hasDesktopPicker(capability), true);
    assert.deepEqual(await chooseFolder(capability), { token: "opaque", name: "Films" });
  });
});
