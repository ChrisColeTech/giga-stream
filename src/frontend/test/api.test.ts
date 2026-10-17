import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { z } from "zod";
import { ApiError, api, apiStream } from "@/services/api";
import { useAppStore } from "@/store/app-store";

/* The request layer's rules are tested in src/shared/http; this file tests the interface's adapter: the events log it
 * writes, the sentences it shows, and its one route that streams. */

const originalFetch = globalThis.fetch;
const AnswerSchema = z.object({ value: z.string() });

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("the interface's request adapter", () => {
  it("logs a success as one host-only Events row", async () => {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/example?private=yes");
      return new Response(JSON.stringify({ ok: true, data: { value: "yes" } }), { status: 200 });
    };

    assert.deepEqual(await api("/api/example?private=yes", AnswerSchema, { method: "GET" }), { value: "yes" });
    const event = useAppStore.getState().events.at(-1);
    assert.match(event?.sentence ?? "", /^GET fileserver 200 in \d+ ms\.$/);
    assert.equal(event?.area, "Connection");
    assert.doesNotMatch(event?.sentence ?? "", /example|private/);
  });

  it("shows the server's refusal sentence, and the table's sentence when the server sent none", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "title.not_found", message: "Gone." } }), {
        status: 404,
      });
    await assert.rejects(api("/api/titles/missing", AnswerSchema), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "title.not_found");
      assert.equal(error.message, "Gone.");
      return true;
    });

    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };
    await assert.rejects(api("/api/example", AnswerSchema), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "fileserver.unreachable");
      assert.equal(error.message, "Could not reach the fileserver.");
      return true;
    });
  });

  it("logs malformed success data as an invalid fileserver row with a warn tone", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: { value: 1 } }), { status: 200 });
    await assert.rejects(api("/api/example", AnswerSchema), { code: "response.invalid" });
    const event = useAppStore.getState().events.at(-1);
    assert.equal(event?.tone, "warn");
    assert.match(event?.sentence ?? "", /fileserver invalid/);
  });

  it("logs no row for a quiet success, and still logs a quiet failure", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: { value: "ok" } }), { status: 200 });
    await api("/api/example", AnswerSchema, { quiet: true });
    assert.equal(useAppStore.getState().events.length, 0);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "x.y", message: "No." } }), { status: 500 });
    await assert.rejects(api("/api/example", AnswerSchema, { quiet: true }));
    assert.equal(useAppStore.getState().events.length, 1);
  });

  it("returns the scan response body, logged in the Scan area", async () => {
    globalThis.fetch = async () => new Response("one\ntwo\n", { status: 200 });
    const body = await apiStream("/api/folders/f-1/scan", { area: "Scan" });
    assert.equal(await new Response(body).text(), "one\ntwo\n");
    assert.equal(useAppStore.getState().events.at(-1)?.area, "Scan");
  });
});
