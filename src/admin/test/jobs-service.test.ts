import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { changedFields, createBody } from "@/lib/job-body";
import { EMPTY_NEW_JOB, draftOf } from "@/lib/job-draft";
import { jobs } from "@/services/jobs";
import type { AdminJob } from "@/services/schemas/job-schema";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const playlistJob: AdminJob = {
  id: 3,
  name: "Sync main",
  type: "playlist",
  enabled: true,
  schedule: "24h",
  config: { playlistId: 1, dryRun: false, prune: false },
  playlistName: "Main",
  running: false,
  createdAt: 1,
};
const catalogJob: AdminJob = {
  ...playlistJob,
  id: 4,
  name: "Trending movies",
  type: "catalog",
  config: { scope: "trending", kind: "movie", pages: 5 },
};
const refusal = (status: number, code: string, message: string) =>
  json({ ok: false, error: { code, message } }, status);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the jobs service", () => {
  it("lists /api/jobs, dropping and counting a row it cannot read", async () => {
    await withBackend(
      () => success({ items: [playlistJob, { id: 9 }, catalogJob] }),
      async (calls) => {
        const list = await jobs.list();
        assert.equal(calls[0]?.url, "/api/jobs");
        assert.deepEqual([list.items.map((item) => item.id), list.unreadable], [[3, 4], 1]);
      },
    );
  });

  it("creates by type: a playlist job names its playlist, a catalog job its scope and kind", async () => {
    await withBackend(
      () => success(playlistJob, 201),
      async (calls) => {
        await jobs.create(createBody({ ...EMPTY_NEW_JOB, name: " Sync main " }, "1"));
        const popular = { ...EMPTY_NEW_JOB, name: "Pop", type: "catalog", scope: "popular", kind: "tv" } as const;
        await jobs.create(createBody(popular, ""));
        assert.deepEqual(calls[0]?.body, { type: "playlist", name: "Sync main", config: { playlistId: 1 } });
        assert.deepEqual(calls[1]?.body, { type: "catalog", name: "Pop", config: { scope: "popular", kind: "tv" } });
      },
    );
  });

  it("patches only what changed, the config as the changed keys the backend merges", async () => {
    await withBackend(
      () => success(catalogJob),
      async (calls) => {
        const draft = { ...draftOf(catalogJob), pages: "8", schedule: " 6H " };
        await jobs.update(4, changedFields(catalogJob, draft));
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["PATCH", "/api/jobs/4"]);
        assert.deepEqual(calls[0]?.body, { schedule: "6h", config: { pages: 8 } });
        assert.deepEqual(changedFields(playlistJob, { ...draftOf(playlistJob), playlistId: "2" }), {
          config: { playlistId: 2 },
        });
        assert.deepEqual(changedFields(playlistJob, draftOf(playlistJob)), {});
      },
    );
  });

  it("runs with the once-only override, or with no body at all, and reads the 202 as the job", async () => {
    await withBackend(
      (call) => success(call.url === "/api/jobs/4/run" ? { ...catalogJob, running: true } : playlistJob, 202),
      async (calls) => {
        await jobs.run(3, { dryRun: true, prune: false });
        const started = await jobs.run(4);
        const first = [calls[0]?.method, calls[0]?.url, calls[0]?.body];
        assert.deepEqual(first, ["POST", "/api/jobs/3/run", { dryRun: true, prune: false }]);
        assert.deepEqual([calls[1]?.url, calls[1]?.body], ["/api/jobs/4/run", undefined]);
        assert.equal(started.running, true);
      },
    );
  });

  it("deletes by id", async () => {
    await withBackend(
      () => success({ id: 3 }),
      async (calls) => {
        assert.deepEqual(await jobs.remove(3), { id: 3 });
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["DELETE", "/api/jobs/3"]);
      },
    );
  });

  it("carries each refusal code with its status and the backend's sentence", async () => {
    const cases: Array<[number, string, string]> = [
      [409, "sync.busy", "That job is already running."],
      [422, "job.disabled", "The job is disabled; enable it to run it."],
      [503, "tmdb.unavailable", "TMDB cannot be reached."],
      [503, "playlist.unreachable", "The playlist cannot be reached."],
      [422, "playlist.invalid", "The playlist is not valid."],
      [409, "playlist.busy", "A playlist sync is already running."],
    ];
    for (const [status, code, message] of cases) {
      await withBackend(
        () => refusal(status, code, message),
        async () => {
          await assert.rejects(jobs.run(3), (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.deepEqual([error.code, error.status, error.message], [code, status, message]);
            return true;
          });
        },
      );
    }
  });
});
