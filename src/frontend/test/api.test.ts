import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { z } from "zod";
import { ApiError, api, apiStream } from "@/services/api";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const AnswerSchema = z.object({ value: z.string() });

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("api", () => {
  it("accepts a validated success envelope and logs host-only traffic", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      assert.equal(input, "/api/example?private=yes");
      assert.equal(init?.method, "GET");
      return new Response(JSON.stringify({ ok: true, data: { value: "yes" } }), { status: 200 });
    };
    globalThis.fetch = fakeFetch;

    assert.deepEqual(await api("/api/example?private=yes", AnswerSchema), { value: "yes" });
    const event = useAppStore.getState().events.at(-1);
    assert.match(event?.sentence ?? "", /^GET fileserver 200 in \d+ ms\.$/);
    assert.doesNotMatch(event?.sentence ?? "", /example|private/);
  });

  it("throws the server refusal with its dotted code and sentence", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "title.not_found", message: "Gone." } }), {
        status: 404,
      });

    await assert.rejects(api("/api/titles/missing", AnswerSchema), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "title.not_found");
      assert.equal(error.message, "Gone.");
      assert.equal(error.status, 404);
      return true;
    });
  });

  it("refuses malformed success data", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: { value: 1 } }), { status: 200 });
    await assert.rejects(api("/api/example", AnswerSchema), { code: "response.invalid" });
    const event = useAppStore.getState().events.at(-1);
    assert.equal(event?.tone, "warn");
    assert.match(event?.sentence ?? "", /fileserver invalid/);
  });

  it("never accepts an absolute or non-api request target", async () => {
    await assert.rejects(api("http://example.test/api/state", AnswerSchema), /relative/);
    await assert.rejects(api("/healthz", AnswerSchema), /relative/);
  });

  it("returns the scan response body without decoding it as an envelope", async () => {
    globalThis.fetch = async () => new Response("one\ntwo\n", { status: 200 });
    const body = await apiStream("/api/folders/f-1/scan", { area: "Scan" });
    assert.equal(await new Response(body).text(), "one\ntwo\n");
  });

  it("decodes a streamed route refusal through the standard envelope", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "job.not_running", message: "Finished." } }), {
        status: 409,
      });
    await assert.rejects(apiStream("/api/folders/f-1/scan"), { code: "job.not_running", status: 409 });
  });

  it("passes keepalive to fetch only when asked", async () => {
    const seen: Array<boolean | undefined> = [];
    globalThis.fetch = async (_input, init) => {
      seen.push(init?.keepalive);
      return new Response(JSON.stringify({ ok: true, data: { value: "ok" } }), { status: 200 });
    };
    await api("/api/example", AnswerSchema, { method: "PUT", body: {}, keepalive: true });
    await api("/api/example", AnswerSchema, { method: "PUT", body: {} });
    assert.deepEqual(seen, [true, undefined]);
  });

  it("logs no Events row for a quiet success but still logs a quiet failure", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: { value: "ok" } }), { status: 200 });
    await api("/api/example", AnswerSchema, { quiet: true });
    assert.equal(useAppStore.getState().events.length, 0);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "x.y", message: "No." } }), { status: 500 });
    await assert.rejects(api("/api/example", AnswerSchema, { quiet: true }));
    assert.equal(useAppStore.getState().events.length, 1);
  });
});
