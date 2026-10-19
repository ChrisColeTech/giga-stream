import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { createBody, patchBody, type NewChannelDraft } from "@/lib/channel-body";
import { liveDraft, streamDraft } from "@/lib/channel-draft";
import { channels } from "@/services/channels";
import { json, success } from "./support/fake-backend";
import { listOf, live, stream } from "./support/channels-kit";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const refusal = (status: number, code: string, field?: string) =>
  json({ ok: false, error: { code, message: "Server sentence.", ...(field && { details: { field } }) } }, status);

const NEW: NewChannelDraft = { name: " Drive ", kind: "live", category: "News", folder: " D:\\v ", streamUrl: "" };

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the channels service", () => {
  it("lists /api/admin/channels, dropping and counting a row it cannot read, with the revision", async () => {
    await withBackend(
      () => success(listOf([live("a"), { id: "broken", kind: "live" }, stream("b")], 12)),
      async (calls) => {
        const list = await channels.list();
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["GET", "/api/admin/channels"]);
        assert.deepEqual([list.items.map((item) => item.id), list.unreadable, list.revision], [["a", "b"], 1, 12]);
        const auth = Object.entries(calls[0]?.headers ?? {}).find(([name]) => name.toLowerCase() === "authorization");
        assert.match(auth?.[1] ?? "", /^Bearer /);
      },
    );
  });

  it("creates a live channel from a folder, and from videos, with no id and no number", async () => {
    await withBackend(
      () => success(live("live-1", { state: "preparing" }), 201),
      async (calls) => {
        const created = await channels.create(createBody(NEW));
        assert.equal(created.kind === "live" && created.state, "preparing");
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["POST", "/api/admin/channels"]);
        assert.deepEqual(calls[0]?.body, { kind: "live", name: "Drive", category: "News", folder: "D:\\v" });
        await channels.create({ kind: "live", name: "V", category: "News", videos: ["D:\\a.mp4"] });
        assert.deepEqual(calls[1]?.body, { kind: "live", name: "V", category: "News", videos: ["D:\\a.mp4"] });
        assert.ok(!Object.hasOwn(Object(calls[0]?.body), "id"));
      },
    );
  });

  it("creates a stream channel with its address", async () => {
    await withBackend(
      () => success(stream("ch_1"), 201),
      async (calls) => {
        await channels.create(createBody({ ...NEW, kind: "stream", category: "Talk", streamUrl: "https://tv.example/a.m3u8" }));
        assert.deepEqual(calls[0]?.body, {
          kind: "stream",
          name: "Drive",
          category: "Talk",
          streamUrl: "https://tv.example/a.m3u8",
        });
      },
    );
  });

  it("patches only the changed fields; folder and videos replace each other", async () => {
    const saved = live("x y");
    await withBackend(
      () => success(saved),
      async (calls) => {
        await channels.update("x y", patchBody(saved, { ...liveDraft(saved), name: "New" }));
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["PATCH", "/api/admin/channels/x%20y"]);
        assert.deepEqual(calls[0]?.body, { name: "New" });
        await channels.update("x y", patchBody(saved, { ...liveDraft(saved), plays: "videos", videos: ["D:\\a.mp4"] }));
        assert.deepEqual(calls[1]?.body, { videos: ["D:\\a.mp4"] });
        const onVideos = live("v", { folder: undefined, videos: ["D:\\a.mp4"] });
        await channels.update("v", patchBody(onVideos, { ...liveDraft(onVideos), plays: "folder", folder: "D:\\f" }));
        assert.deepEqual(calls[2]?.body, { folder: "D:\\f" });
        const s = stream("s");
        await channels.update("s", patchBody(s, { ...streamDraft(s), logoUrl: "https://tv.example/l.png", enabled: false }));
        assert.deepEqual(calls[3]?.body, { logoUrl: "https://tv.example/l.png", enabled: false });
      },
    );
  });

  it("deletes, rebuilds and reverts on their routes", async () => {
    await withBackend(
      (call) => {
        if (call.method === "DELETE") return success({ id: "a" });
        return success(call.url.endsWith("/revert") ? stream("a") : live("a", { state: "preparing" }));
      },
      async (calls) => {
        assert.deepEqual(await channels.remove("a"), { id: "a" });
        await channels.rebuild("a");
        await channels.revert("a");
        assert.deepEqual(
          calls.map((call) => `${call.method} ${call.url}`),
          [
            "DELETE /api/admin/channels/a",
            "POST /api/admin/channels/a/rebuild",
            "POST /api/admin/channels/a/revert",
          ],
        );
      },
    );
  });

  it("reads ONE channel from GET /api/admin/channels/:id, never the list route", async () => {
    await withBackend(
      () => success(live("a b", { state: "failed" })),
      async (calls) => {
        const row = await channels.readOne("a b");
        assert.deepEqual([calls.length, calls[0]?.method, calls[0]?.url], [1, "GET", "/api/admin/channels/a%20b"]);
        assert.deepEqual([row.kind, row.kind === "live" && row.state], ["live", "failed"]);
      },
    );
  });

  it("sets a verdict with PUT /status and parses the answered row", async () => {
    await withBackend(
      () => success(stream("a", { status: "offline", checkedAt: 55 })),
      async (calls) => {
        const row = await channels.setStatus("a", "offline");
        assert.deepEqual([calls[0]?.method, calls[0]?.url, calls[0]?.body], ["PUT", "/api/admin/channels/a/status", { status: "offline" }]);
        assert.deepEqual([row.kind === "stream" && row.status, row.kind === "stream" && row.checkedAt], ["offline", 55]);
      },
    );
    await withBackend(
      () => refusal(422, "channel.not_stream"),
      async () => assert.rejects(channels.setStatus("a", "online"), { code: "channel.not_stream", status: 422 }),
    );
  });

  it("carries the field of a 409 and a 422 refusal, and answers bad_response for an unreadable write", async () => {
    await withBackend(
      (call) => {
        if (call.url === "/api/admin/channels") return refusal(409, "channel.taken", "number");
        if (call.method === "PATCH") return refusal(422, "channel.invalid", "videos.1");
        return success({ nope: 1 });
      },
      async () => {
        await assert.rejects(channels.create({}), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.deepEqual([error.code, error.status, error.field], ["channel.taken", 409, "number"]);
          return true;
        });
        await assert.rejects(channels.update("a", { videos: [] }), { code: "channel.invalid", status: 422, field: "videos.1" });
        await assert.rejects(channels.rebuild("a"), { code: "backend.bad_response" });
      },
    );
  });
});
