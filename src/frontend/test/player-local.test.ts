import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { localMediaAddress, readLocalMediaInfo } from "@/services/local-media";
import { applyOpeningPosition } from "@/lib/player-opening";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => { globalThis.fetch = originalFetch; });

describe("local Player media", () => {
  it("reads file facts and publishes only the id-based Range address", async () => {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/media/local/local%2F1/info");
      return new Response(JSON.stringify({ ok: true, data: {
        id: "local/1", title: "Movie.mp4", durationMs: 90_000, sizeBytes: 1000,
        width: 1920, height: 1080, videoCodec: "h264", audioCodec: "aac", container: "mp4",
        playable: true, collectionIds: ["films"], folderName: "Movies",
      } }), { status: 200 });
    };
    const info = await readLocalMediaInfo("local/1");
    assert.equal(info.playable, true);
    assert.equal(info.durationMs, 90_000);
    assert.equal(localMediaAddress("local/1"), "/api/media/local/local%2F1");
  });

  it("rejects malformed local facts so retry can re-read the route", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: {
      id: "local-1", title: "Movie", playable: "yes", collectionIds: [], folderName: "Movies",
    } }), { status: 200 });
    await assert.rejects(readLocalMediaInfo("local-1"), { code: "response.invalid" });
  });

  it("seeks in seconds after metadata and permits the info route to be retried", async () => {
    const media = { currentTime: 0 };
    applyOpeningPosition(media, 12_500);
    assert.equal(media.currentTime, 12.5);
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ ok: true, data: {
        id: "local-1", title: "Movie", playable: true, collectionIds: [], folderName: "Movies",
      } }), { status: 200 });
    };
    await readLocalMediaInfo("local-1");
    await readLocalMediaInfo("local-1");
    assert.equal(calls, 2);
  });
});
