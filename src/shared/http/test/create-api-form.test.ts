import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { createApi } from "../src/create-api";
import type { FetchLike } from "../src/request-types";

const Answer = z.object({ value: z.string() });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function client(fetch: FetchLike) {
  return createApi<"Connection">({
    sentences: {},
    failureCodes: { invalid: "backend.bad_response", unreachable: "backend.unreachable" },
    defaultArea: "Connection",
    fetch,
    headers: () => ({ authorization: "Bearer token" }),
  });
}

describe("createApi: a form body", () => {
  it("sends the FormData as is, with no JSON content type, so the runtime adds the boundary", async () => {
    const seen: RequestInit[] = [];
    const layer = client(async (_input, init) => {
      seen.push(init ?? {});
      return json({ ok: true, data: { value: "yes" } }, 201);
    });
    const form = new FormData();
    form.append("file", new Blob(["#EXTM3U"]), "us.m3u");

    assert.deepEqual(await layer.api("/api/playlists/import", Answer, { method: "POST", form }), { value: "yes" });
    const [init] = seen;
    assert.equal(init?.body, form);
    assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, { authorization: "Bearer token" });
  });

  it("still sends a JSON body with its content type when there is no form", async () => {
    const seen: RequestInit[] = [];
    const layer = client(async (_input, init) => {
      seen.push(init ?? {});
      return json({ ok: true, data: { value: "yes" } });
    });

    await layer.api("/api/playlists", Answer, { method: "POST", body: { url: "https://example.com/a.m3u" } });
    const [init] = seen;
    assert.equal(init?.body, JSON.stringify({ url: "https://example.com/a.m3u" }));
    assert.deepEqual(init?.headers, { authorization: "Bearer token", "content-type": "application/json" });
  });
});
