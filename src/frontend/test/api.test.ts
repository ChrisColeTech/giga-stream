import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { z } from "zod";
import { ApiError, api } from "@/services/api";
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
});
