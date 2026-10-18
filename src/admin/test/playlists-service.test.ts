import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { changedFields, createBody } from "@/lib/playlist-body";
import { draftOf, startReplace } from "@/lib/playlist-draft";
import { playlists } from "@/services/playlists";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const SECRET = "https://iptv.example.test/get.php?username=u&password=hunter2";
const row = (id: number, extra: Partial<AdminPlaylist> = {}): AdminPlaylist => ({
  id,
  name: `List ${id}`,
  host: "iptv.example.test",
  masked: "iptv.example.test/…",
  enabled: true,
  channels: 3,
  ...extra,
});
const refusal = (status: number, code: string, field?: string) =>
  json({ ok: false, error: { code, message: "Server sentence.", ...(field && { details: { field } }) } }, status);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the playlists service", () => {
  it("lists /api/playlists with the bearer, dropping and counting a row it cannot read", async () => {
    await withBackend(
      () => success({ items: [row(1), { id: "broken" }, row(2)] }),
      async (calls) => {
        const list = await playlists.list();
        assert.deepEqual([calls[0]?.url, calls[0]?.method], ["/api/playlists", "GET"]);
        assert.ok(String(calls[0]?.headers["authorization"]).startsWith("Bearer "));
        assert.deepEqual([list.items.map((item) => item.id), list.unreadable], [[1, 2], 1]);
      },
    );
  });

  it("posts the trimmed address, and the name only when one was typed", async () => {
    await withBackend(
      () => success(row(9), 201),
      async (calls) => {
        await playlists.create(createBody({ name: "  ", address: ` ${SECRET} ` }));
        await playlists.create(createBody({ name: " Main ", address: SECRET }));
        assert.deepEqual(calls[0]?.body, { address: SECRET });
        assert.deepEqual(calls[1]?.body, { address: SECRET, name: "Main" });
      },
    );
  });

  it("never reads an address back: the answer carries the host and the masked form only", async () => {
    await withBackend(
      () => success({ ...row(9), address: SECRET }),
      async () => {
        const created = await playlists.create(createBody({ name: "", address: SECRET }));
        assert.ok(!JSON.stringify(created).includes("hunter2"));
        assert.deepEqual(Object.keys(created).sort(), ["channels", "enabled", "host", "id", "masked", "name"]);
      },
    );
  });

  it("patches only the changed fields: Replace sends the address, an unchanged one sends nothing", async () => {
    const saved = row(4);
    await withBackend(
      () => success(saved),
      async (calls) => {
        await playlists.update(4, changedFields(saved, { ...draftOf(saved), enabled: false }));
        await playlists.update(4, changedFields(saved, { ...startReplace(draftOf(saved)), address: SECRET }));
        const first = [calls[0]?.method, calls[0]?.url, calls[0]?.body];
        assert.deepEqual(first, ["PATCH", "/api/playlists/4", { enabled: false }]);
        assert.deepEqual(calls[1]?.body, { address: SECRET });
        assert.deepEqual(changedFields(saved, startReplace(draftOf(saved))), {});
      },
    );
  });

  it("deletes by id and answers how many channels were released", async () => {
    await withBackend(
      () => success({ id: 4, released: 14 }),
      async (calls) => {
        assert.deepEqual(await playlists.remove(4), { id: 4, released: 14 });
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["DELETE", "/api/playlists/4"]);
      },
    );
  });

  it("carries the field of a 422 playlist.invalid, and answers bad_response for an unreadable write", async () => {
    await withBackend(
      (call) => (call.method === "POST" ? refusal(422, "playlist.invalid", "address") : success({ nope: 1 })),
      async () => {
        await assert.rejects(playlists.create({ address: SECRET }), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.deepEqual([error.code, error.status, error.field], ["playlist.invalid", 422, "address"]);
          assert.ok(!error.message.includes("hunter2"));
          return true;
        });
        await assert.rejects(playlists.update(1, { enabled: true }), { code: "backend.bad_response" });
      },
    );
  });
});
