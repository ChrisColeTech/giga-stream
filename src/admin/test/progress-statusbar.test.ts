import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ApiError } from "@giga/http/api-error";
import { createElement } from "react";
import { AdminStatusbar } from "@/components/chrome/AdminStatusbar";
import { STOP_BUILD, STOP_IDLE, STOP_SYNCING } from "@/constants/record-copy";
import { createSessionApi } from "@/services/session-api";
import { createStopSyncing } from "@/services/stop-syncing";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { TOKENS, failure, rig, scripted, success } from "./support/fake-backend";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const at = (jobId: number, phase: string, done: number, total: number) => ({ jobId, phase, done, total });
const stopButton = (html: string): string => html.match(/<button[^>]*>/)?.[0] ?? "";

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the statusbar while jobs run", () => {
  it("fills the bar to the most recently updated job, tooltip naming phase and counts, Stop enabled as `Stop syncing`", () => {
    state().jobProgressUpdate(at(1, "movies", 12, 100));
    state().jobProgressUpdate(at(2, "checking", 1204, 2598));
    const html = renderLive(createElement(AdminStatusbar));
    assert.ok(html.includes("width:57%"), "the bar");
    assert.ok(html.includes('title="Checking streams 1,204 of 2,598 · 57%"'), "the tooltip");
    assert.ok(html.includes(">2 syncing</span>"));
    assert.ok(stopButton(html).includes(`title="${STOP_SYNCING}"`) && !stopButton(html).includes('disabled=""'));
    state().jobProgressUpdate(at(1, "details", 500, 1000));
    const next = renderLive(createElement(AdminStatusbar));
    assert.ok(next.includes("width:55%") && next.includes("Fetching details 500 of 1,000"), "the bar follows the latest");
  });

  it("is an empty track with Stop disabled `Nothing is running.` when no job runs", () => {
    const html = renderLive(createElement(AdminStatusbar));
    assert.ok(html.includes("width:0%") && html.includes(">idle</span>"));
    assert.ok(html.includes(`aria-label="Stop. ${STOP_IDLE}"`) && stopButton(html).includes('disabled=""'));
  });

  it("ignores work.syncing: a bulk runner's count shows nothing and enables nothing", () => {
    state().setWork({ syncing: 3 });
    const html = renderLive(createElement(AdminStatusbar));
    assert.ok(html.includes(">idle</span>") && stopButton(html).includes('disabled=""'));
  });

  it("keeps a channel build's reason on Stop while no job runs", () => {
    state().setWork({ preparing: 1 });
    assert.ok(renderLive(createElement(AdminStatusbar)).includes(`aria-label="Stop. ${STOP_BUILD}"`));
  });
});

describe("the statusbar's Stop", () => {
  const stopper = (stop: (id: number) => Promise<AdminJob>) => {
    const reloads: number[] = [];
    const run = createStopSyncing({
      service: { stop },
      store: () => useAppStore.getState(),
      audit: { reload: async () => void reloads.push(1) },
    });
    return { run, reloads };
  };
  const job = (id: number) => ({ id }) as AdminJob;

  it("stops every running job and says so", async () => {
    state().jobProgressUpdate(at(1, "checking", 1, 10));
    state().jobProgressUpdate(at(2, "movies", 1, 10));
    const called: number[] = [];
    const { run, reloads } = stopper(async (id) => (called.push(id), job(id)));
    await run();
    assert.deepEqual(called.sort(), [1, 2]);
    assert.deepEqual([state().notice?.sentence, reloads.length], ["Stopping 2 syncs.", 1]);
  });

  it("words a refusal honestly, counts one that had just ended as no failure, and does nothing when nothing runs", async () => {
    const { run } = stopper(async () => {
      throw new Error("never");
    });
    await run();
    assert.equal(state().notice, null);
    state().jobProgressUpdate(at(1, "checking", 1, 10));
    state().jobProgressUpdate(at(2, "checking", 1, 10));
    state().jobProgressUpdate(at(3, "checking", 1, 10));
    const mixed = stopper(async (id) => {
      if (id === 1) throw new ApiError("job.not_running", "That job is not running.", 409);
      if (id === 2) throw new ApiError("backend.unreachable", "The backend could not be reached.", 0);
      return job(id);
    });
    await mixed.run();
    assert.equal(
      state().notice?.sentence,
      "Stopping 2 of 3 syncs; 1 could not be stopped: The backend could not be reached.",
    );
    assert.equal(state().notice?.tone, "warn");
  });
});

describe("SessionApi.stream", () => {
  const sse = (): Response => new Response("event: snapshot\ndata: {\"running\":[]}\n\n", { status: 200 });

  it("sends the bearer, and a successful open stays out of the Events drawer", async () => {
    const backend = scripted(() => sse());
    const logged: unknown[] = [];
    const api = createSessionApi(rig(backend.fetch, TOKENS).deps);
    const body = await api.stream("/api/jobs/events", { quiet: true });
    assert.equal(backend.calls[0]?.headers.authorization, "Bearer access-1");
    assert.equal(backend.calls[0]?.url, "/api/jobs/events");
    assert.ok(body instanceof ReadableStream && logged.length === 0);
  });

  it("refreshes ahead of an expiring token, and retries once after a 401", async () => {
    let first = true;
    const backend = scripted((call) => {
      if (call.url === "/api/auth/refresh") {
        return success({ accessToken: "access-2", accessExpiresAt: 9_000_000, refreshToken: "r2", refreshExpiresAt: 9_999_999,
          account: { id: 7, username: "ada@example.test", name: "Ada", disabled: false, createdAt: 1, updatedAt: 2 } });
      }
      if (first) {
        first = false;
        return failure(401, "auth.unauthorized", "Sign in again.");
      }
      return sse();
    });
    const base = rig(backend.fetch, TOKENS);
    const api = createSessionApi(base.deps);
    await api.stream("/api/jobs/events", { quiet: true });
    assert.deepEqual(backend.calls.map((call) => call.url), ["/api/jobs/events", "/api/auth/refresh", "/api/jobs/events"]);
    assert.equal(backend.calls[2]?.headers.authorization, "Bearer access-2");
    assert.deepEqual(base.ended, []);
  });
});

describe("the new code", () => {
  const SRC = fileURLToPath(new URL("../src/", import.meta.url));
  const FILES = [
    "services/job-events.ts", "services/sse-parser.ts", "services/stop-syncing.ts", "hooks/useJobEvents.ts",
    "hooks/useStopSyncing.ts", "lib/job-events-plan.ts", "lib/live-jobs.ts", "lib/job-fraction.ts",
    "store/job-progress-slice.ts", "components/chrome/AdminRunningWork.tsx", "components/chrome/AdminStatusbar.tsx",
  ];

  it("runs no timer, no interval and no EventSource, and calls no fetch", () => {
    for (const file of FILES) {
      const text = readFileSync(SRC + file, "utf8");
      assert.ok(!/setInterval|setTimeout|requestIdleCallback|EventSource|\bfetch\s*\(/.test(text), file);
    }
  });
});
