import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { changedFields, urlBody } from "@/lib/playlist-body";
import { draftOf } from "@/lib/playlist-draft";
import { playlists } from "@/services/playlists";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { counts, filePlaylist, playlist as row } from "./support/run-kit";
import { resetStore, signInForTest } from "./support/store";

const SECRET = "https://iptv.example.test/get.php?username=u&password=hunter2";
const IMPORTED = { created: 3, updated: 0, skipped: 1, refused: 0, refusalExamples: [] };
const refusal = (status: number, code: string, field?: string) =>
  json({ ok: false, error: { code, message: "Server sentence.", ...(field && { details: { field } }) } }, status);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the playlists service", () => {
  it("lists /api/playlists with the bearer, dropping and counting a row it cannot read", async () => {
    await withBackend(
      () => success({ items: [row(1), { id: "broken" }, filePlaylist(2)] }),
      async (calls) => {
        const list = await playlists.list();
        assert.deepEqual([calls[0]?.url, calls[0]?.method], ["/api/playlists", "GET"]);
        assert.ok(String(calls[0]?.headers["authorization"]).startsWith("Bearer "));
        assert.deepEqual([list.items.map((item) => item.id), list.unreadable], [[1, 2], 1]);
        assert.deepEqual(list.items.map((item) => item.kind), ["url", "file"]);
      },
    );
  });

  it("reads the typed last run joined into a playlist, and an unreadable one as absent", async () => {
    const ran = { ...row(1), lastRunAt: 9, lastResult: "ok", lastCounts: counts({ created: 2 }) };
    const odd = { ...row(2), lastResult: "exploded", lastCounts: { created: "many" } };
    await withBackend(
      () => success({ items: [ran, odd] }),
      async () => {
        const list = await playlists.list();
        assert.equal(list.unreadable, 0);
        assert.deepEqual([list.items[0]?.lastResult, list.items[1]?.lastResult, list.items[1]?.lastCounts], ["ok", undefined, undefined]);
      },
    );
  });

  it("imports a file as one multipart `file` part, with the bearer and no JSON content type", async () => {
    await withBackend(
      () => success({ ...filePlaylist(3), created: true, imported: IMPORTED }, 201),
      async (calls) => {
        const answer = await playlists.importFile(new File(["#EXTM3U\n"], "us.m3u"));
        const [call] = calls;
        assert.deepEqual([call?.method, call?.url], ["POST", "/api/playlists/import"]);
        assert.ok(String(call?.headers["authorization"]).startsWith("Bearer "));
        assert.equal(call?.headers["content-type"], undefined, "the runtime adds the multipart boundary");
        const file = call?.form?.get("file");
        assert.ok(file instanceof File && file.name === "us.m3u");
        assert.deepEqual([...(call?.form?.keys() ?? [])], ["file"]);
        assert.deepEqual([answer.created, answer.imported.created, answer.imported.skipped], [true, 3, 1]);
        assert.equal(answer.playlist.fileName, "us.m3u");
        assert.equal("imported" in answer.playlist, false);
      },
    );
  });

  it("imports a web address as JSON `{ url }`, and the answer's `url` is read in full", async () => {
    await withBackend(
      () => success({ ...row(9), url: SECRET, created: true, imported: IMPORTED }, 201),
      async (calls) => {
        const answer = await playlists.create(urlBody({ source: "url", file: null, address: ` ${SECRET} ` }));
        assert.deepEqual(calls[0]?.body, { url: SECRET });
        assert.equal(calls[0]?.headers["content-type"], "application/json");
        assert.equal(answer.playlist.url, SECRET);
        assert.equal("masked" in answer.playlist, false);
      },
    );
  });

  it("patches only the changed fields: an edited address sends `url`, an unchanged one sends nothing", async () => {
    const saved = row(4);
    await withBackend(
      () => success(saved),
      async (calls) => {
        await playlists.update(4, changedFields(saved, { ...draftOf(saved), enabled: false }));
        await playlists.update(4, changedFields(saved, { ...draftOf(saved), address: SECRET }));
        assert.deepEqual([calls[0]?.method, calls[0]?.url, calls[0]?.body], ["PATCH", "/api/playlists/4", { enabled: false }]);
        assert.deepEqual(calls[1]?.body, { url: SECRET });
        assert.deepEqual(changedFields(saved, draftOf(saved)), {});
      },
    );
  });

  it("deletes by id and answers the channels and jobs that went with it", async () => {
    await withBackend(
      () => success({ id: 4, deletedChannels: 2598, deletedJobs: 1 }),
      async (calls) => {
        assert.deepEqual(await playlists.remove(4), { id: 4, deletedChannels: 2598, deletedJobs: 1 });
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["DELETE", "/api/playlists/4"]);
      },
    );
  });

  it("carries the field of a 422 playlist.invalid and a 409 playlist.taken, and answers bad_response for an unreadable write", async () => {
    await withBackend(
      (call) =>
        call.method === "POST" && call.url === "/api/playlists/import"
          ? refusal(409, "playlist.taken")
          : call.method === "POST"
            ? refusal(422, "playlist.invalid", "url")
            : success({ nope: 1 }),
      async () => {
        await assert.rejects(playlists.create({ url: SECRET }), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.deepEqual([error.code, error.status, error.field], ["playlist.invalid", 422, "url"]);
          assert.ok(!error.message.includes("hunter2"));
          return true;
        });
        await assert.rejects(playlists.importFile(new File(["x"], "a.m3u")), { code: "playlist.taken", status: 409 });
        await assert.rejects(playlists.update(1, { enabled: true }), { code: "backend.bad_response" });
      },
    );
  });
});
