import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { changedFields, createBody } from "@/lib/job-body";
import { EMPTY_NEW_JOB, draftOf } from "@/lib/job-draft";
import { jobs } from "@/services/jobs";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { catalogJob as catalog, counts, playlistJob as playlist } from "./support/run-kit";
import { resetStore, signInForTest } from "./support/store";

const playlistJob = playlist(3, 1, { name: "Sync Main", playlistName: "Main" });
const catalogJob = catalog(4, { name: "Trending movies" });
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

  it("reads the typed last run the backend joins in, and a discover job that has no kind", async () => {
    const ran = { ...playlistJob, lastRunAt: 9, lastResult: "ok", lastCounts: counts({ created: 2 }) };
    const discover = { ...catalogJob, id: 5, config: { scope: "discover", pages: 100 } };
    await withBackend(
      () => success({ items: [ran, discover] }),
      async () => {
        const list = await jobs.list();
        assert.equal(list.unreadable, 0);
        assert.deepEqual([list.items[0]?.lastResult, list.items[0]?.playlistName], ["ok", "Main"]);
        assert.equal(list.items[1]?.type, "catalog");
      },
    );
  });

  it("creates catalog jobs only: the scope and kind, and a discover job sends no kind", async () => {
    await withBackend(
      () => success(catalogJob, 201),
      async (calls) => {
        const popular = { ...EMPTY_NEW_JOB, name: " Pop ", scope: "popular", kind: "tv" } as const;
        await jobs.create(createBody(popular));
        await jobs.create(createBody({ ...popular, scope: "discover" }));
        assert.deepEqual(calls[0]?.body, { type: "catalog", name: "Pop", config: { scope: "popular", kind: "tv" } });
        assert.deepEqual(calls[1]?.body, { type: "catalog", name: "Pop", config: { scope: "discover" } });
      },
    );
  });

  it("patches only what changed; a playlist job sends enabled and schedule only, never a name or a config", async () => {
    await withBackend(
      () => success(catalogJob),
      async (calls) => {
        const draft = { ...draftOf(catalogJob), pages: "8", schedule: " 12H " };
        await jobs.update(4, changedFields(catalogJob, draft));
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["PATCH", "/api/jobs/4"]);
        assert.deepEqual(calls[0]?.body, { schedule: "12h", config: { pages: 8 } });
        const edited = { ...draftOf(playlistJob), name: "Renamed", enabled: false, schedule: "30m" };
        assert.deepEqual(changedFields(playlistJob, edited), { enabled: false, schedule: "30m" });
        assert.deepEqual(changedFields(playlistJob, draftOf(playlistJob)), {});
      },
    );
  });

  it("runs with no body at all (no dry run, no prune) and reads the 202 as the job, running", async () => {
    await withBackend(
      (call) => success({ ...(call.url === "/api/jobs/4/run" ? catalogJob : playlistJob), running: true }, 202),
      async (calls) => {
        const started = await jobs.run(3);
        await jobs.run(4);
        assert.deepEqual([calls[0]?.method, calls[0]?.url, calls[0]?.body], ["POST", "/api/jobs/3/run", undefined]);
        assert.deepEqual([calls[1]?.url, calls[1]?.body], ["/api/jobs/4/run", undefined]);
        assert.equal(started.running, true);
      },
    );
  });

  it("deletes by id", async () => {
    await withBackend(
      () => success({ id: 4 }),
      async (calls) => {
        assert.deepEqual(await jobs.remove(4), { id: 4 });
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["DELETE", "/api/jobs/4"]);
      },
    );
  });

  it("carries each refusal code with its status and the backend's sentence", async () => {
    const cases: Array<[number, string, string]> = [
      [409, "sync.busy", "That job is already running."],
      [422, "job.disabled", "The job is disabled; enable it to run it."],
      [503, "tmdb.unavailable", "TMDB cannot be reached."],
      [422, "job.invalid", "A playlist's job goes with the playlist."],
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
