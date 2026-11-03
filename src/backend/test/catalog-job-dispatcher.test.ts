import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/constants/errors.js";
import { createCatalogJobDispatcher } from "../src/services/catalog-job-dispatcher.js";
import type { CatalogJob } from "../src/store/job-repository.js";

const fill: CatalogJob = { id: 6, name: "Fill", type: "catalog", enabled: true, schedule: "off",
  config: { scope: "discover" }, createdAt: 1 };
const update: CatalogJob = { id: 7, name: "Update", type: "catalog", enabled: true, schedule: "24h",
  config: { scope: "recent" }, createdAt: 1 };

function harness(runStatus = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, ...(init !== undefined && { init }) });
    if (url.startsWith("http://metadata.google.internal/")) {
      return new Response(JSON.stringify({ access_token: "access" }), { status: 200 });
    }
    return new Response(url.endsWith(":run") ? "{}" : JSON.stringify({ executions: [] }), { status: runStatus });
  };
  const dispatcher = createCatalogJobDispatcher({
    project: "project", region: "region", fillJob: "fill-job", updateJob: "update-job", fetch: fetcher,
  });
  assert.ok(dispatcher);
  return { calls, dispatcher };
}

test("the dispatcher selects the bounded worker and passes the database job id as an execution override", async () => {
  for (const [job, worker] of [[fill, "fill-job"], [update, "update-job"]] as const) {
    const h = harness();
    await h.dispatcher.run(job);
    assert.equal(h.calls.length, 4);
    assert.match(h.calls[3]?.url ?? "", new RegExp(`/jobs/${worker}:run$`));
    assert.equal(new Headers(h.calls[3]?.init?.headers).get("authorization"), "Bearer access");
    assert.deepEqual(JSON.parse(String(h.calls[3]?.init?.body)), {
      overrides: { containerOverrides: [{ env: [{ name: "SYNC_JOB_ID", value: String(job.id) }] }] },
    });
  }
});

test("missing configuration leaves dispatch disabled, and target failures are stable", async () => {
  assert.equal(createCatalogJobDispatcher({ project: "", region: "r", fillJob: "f", updateJob: "u" }), undefined);
  const h = harness(403);
  await assert.rejects(h.dispatcher.run(update), (error: unknown) =>
    error instanceof AppError && error.code === "job.dispatch_unavailable" && error.status === 503);
});

test("an active fill or update execution prevents another catalog execution", async () => {
  const fetcher: typeof fetch = async (input) => String(input).startsWith("http://metadata.google.internal/")
    ? new Response(JSON.stringify({ access_token: "access" }))
    : new Response(JSON.stringify({ executions: [{ name: "active" }] }));
  const dispatcher = createCatalogJobDispatcher({
    project: "project", region: "region", fillJob: "fill", updateJob: "update", fetch: fetcher,
  });
  assert.ok(dispatcher);
  await assert.rejects(dispatcher.run(update), { code: "sync.busy" });
});
