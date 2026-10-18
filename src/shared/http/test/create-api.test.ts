import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { ApiError } from "../src/api-error";
import { createApi } from "../src/create-api";
import type { ApiConfig, FetchLike, RequestEvent } from "../src/request-types";

type Area = "Connection" | "Scan";

const Answer = z.object({ value: z.string() });

/* The program's own table: the codes the layer raises itself resolve through it; any other code gets the fallback. */
const SENTENCES = {
  "title.not_found": "That title could not be found.",
  "backend.unreachable": "Could not reach the admin backend.",
  "backend.bad_response": "The admin backend returned an unreadable answer.",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/* A fake clock that moves five milliseconds per reading, so every event reports five. */
function clock(): () => number {
  let now = 0;
  return () => (now += 5);
}

function client(fetch: FetchLike, extra: Partial<ApiConfig<Area>> = {}) {
  const events: RequestEvent<Area>[] = [];
  const layer = createApi<Area>({
    sentences: SENTENCES,
    failureCodes: { invalid: "backend.bad_response", unreachable: "backend.unreachable" },
    defaultArea: "Connection",
    fetch,
    now: clock(),
    onEvent: (event) => events.push(event),
    ...extra,
  });
  return { ...layer, events };
}

describe("createApi: the envelope", () => {
  it("accepts a validated success and reports the method, status and area, never the address", async () => {
    const seen: string[] = [];
    const layer = client(async (input) => {
      seen.push(input);
      return json({ ok: true, data: { value: "yes" } });
    });

    assert.deepEqual(await layer.api("/api/example?private=yes", Answer), { value: "yes" });
    assert.deepEqual(seen, ["/api/example?private=yes"]);
    assert.deepEqual(layer.events, [{ method: "GET", status: 200, elapsedMs: 5, area: "Connection" }]);
    assert.doesNotMatch(JSON.stringify(layer.events), /private|example/);
  });

  it("throws a refusal with its dotted code, the server's sentence and the status", async () => {
    const layer = client(async () => json({ ok: false, error: { code: "title.not_found", message: "Gone." } }, 404));
    await assert.rejects(layer.api("/api/titles/missing", Answer), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "title.not_found");
      assert.equal(error.message, "Gone.");
      assert.equal(error.status, 404);
      return true;
    });
    assert.equal(layer.events[0]?.status, 404);
  });

  it("carries details.field and the correlation id of a refusal", async () => {
    const error = { code: "account.invalid", message: "Bad.", details: { field: "username" }, correlationId: "c-1" };
    const layer = client(async () => json({ ok: false, error }, 422));
    await assert.rejects(layer.api("/api/example", Answer), { field: "username", correlationId: "c-1", status: 422 });
  });

  it("leaves field undefined without details", async () => {
    const layer = client(async () => json({ ok: false, error: { code: "title.not_found", message: "Gone." } }, 404));
    await assert.rejects(layer.api("/api/example", Answer), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.field, undefined);
      assert.equal(error.correlationId, undefined);
      return true;
    });
  });

  it("ignores a field that is not a string, on the stream path too", async () => {
    const error = { code: "account.invalid", message: "Bad.", details: { field: 7 } };
    const layer = client(async () => json({ ok: false, error }, 422));
    await assert.rejects(layer.api("/api/example", Answer), { field: undefined });
    await assert.rejects(layer.apiStream("/api/example"), { field: undefined, code: "account.invalid" });
  });

  it("refuses success data that does not match the schema as the invalid code, reported invalid", async () => {
    const layer = client(async () => json({ ok: true, data: { value: 1 } }));
    await assert.rejects(layer.api("/api/example", Answer), { code: "backend.bad_response" });
    assert.equal(layer.events[0]?.status, "invalid");
  });

  it("treats a body that is not JSON as the invalid code, keeping the HTTP status", async () => {
    const layer = client(async () => new Response("<html>", { status: 502 }));
    await assert.rejects(layer.api("/api/example", Answer), { code: "backend.bad_response", status: 502 });
    assert.equal(layer.events[0]?.status, "invalid");
  });

  it("raises the unreachable code with no status when the fetch rejects, reported unreachable", async () => {
    const layer = client(async () => {
      throw new TypeError("offline");
    });
    await assert.rejects(layer.api("/api/example", Answer), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "backend.unreachable");
      assert.equal(error.message, "Could not reach the admin backend.");
      assert.equal(error.status, undefined);
      return true;
    });
    assert.equal(layer.events[0]?.status, "unreachable");
  });

  it("rethrows an abandoned request and reports it aborted", async () => {
    const layer = client(async () => {
      throw new DOMException("gone", "AbortError");
    });
    await assert.rejects(layer.api("/api/example", Answer), (error: unknown) => error instanceof DOMException);
    assert.equal(layer.events[0]?.status, "aborted");
  });

  it("never accepts an absolute or non-api request target, and sends nothing", async () => {
    let calls = 0;
    const layer = client(async () => {
      calls += 1;
      return json({ ok: true, data: { value: "x" } });
    });
    await assert.rejects(layer.api("http://example.test/api/state", Answer), /relative/);
    await assert.rejects(layer.api("/healthz", Answer), /relative/);
    assert.equal(calls, 0);
  });
});

describe("createApi: the configuration", () => {
  it("prefixes the base, and reads the headers on every request", async () => {
    let token = "first";
    const seen: Array<{ url: string; authorization: string | undefined }> = [];
    const layer = client(
      async (input, init) => {
        const headers = init?.headers as Record<string, string> | undefined;
        seen.push({ url: input, authorization: headers?.authorization });
        return json({ ok: true, data: { value: "ok" } });
      },
      { base: "http://127.0.0.1:8091", headers: () => ({ authorization: `Bearer ${token}` }) },
    );
    await layer.api("/api/a", Answer);
    token = "second";
    await layer.api("/api/b", Answer);
    assert.deepEqual(seen, [
      { url: "http://127.0.0.1:8091/api/a", authorization: "Bearer first" },
      { url: "http://127.0.0.1:8091/api/b", authorization: "Bearer second" },
    ]);
  });

  it("calls onUnauthorized on a 401, and still throws the refusal", async () => {
    let unauthorized = 0;
    const layer = client(async () => json({ ok: false, error: { code: "auth.required", message: "Sign in." } }, 401), {
      onUnauthorized: () => {
        unauthorized += 1;
      },
    });
    await assert.rejects(layer.api("/api/example", Answer), { code: "auth.required", status: 401 });
    assert.equal(unauthorized, 1);
  });

  it("uses the program's sentence for a raised code and the fallback for a code outside its table", async () => {
    const layer = client(
      async () => {
        throw new TypeError("offline");
      },
      { failureCodes: { invalid: "backend.bad_response", unreachable: "net.down" } },
    );
    await assert.rejects(layer.api("/api/example", Answer), { code: "net.down", message: "The request failed." });
  });

  it("sends keepalive and the JSON body only when asked", async () => {
    const seen: Array<{ keepalive: boolean | undefined; body: unknown; type: string | undefined }> = [];
    const layer = client(async (_input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      seen.push({ keepalive: init?.keepalive, body: init?.body, type: headers?.["content-type"] });
      return json({ ok: true, data: { value: "ok" } });
    });
    await layer.api("/api/example", Answer, { method: "PUT", body: { a: 1 }, keepalive: true });
    await layer.api("/api/example", Answer, { method: "PUT", body: { a: 1 } });
    assert.deepEqual(seen, [
      { keepalive: true, body: '{"a":1}', type: "application/json" },
      { keepalive: undefined, body: '{"a":1}', type: "application/json" },
    ]);
  });

  it("reports no event for a quiet success and still reports a quiet failure", async () => {
    const layer = client(async () => json({ ok: true, data: { value: "ok" } }));
    await layer.api("/api/example", Answer, { quiet: true });
    assert.equal(layer.events.length, 0);

    const failing = client(async () => json({ ok: false, error: { code: "x.y", message: "No." } }, 500));
    await assert.rejects(failing.api("/api/example", Answer, { quiet: true }));
    assert.equal(failing.events.length, 1);
  });

  it("names the area of a request, or the default when it names none", async () => {
    const layer = client(async () => json({ ok: true, data: { value: "ok" } }));
    await layer.api("/api/example", Answer, { area: "Scan" });
    await layer.api("/api/example", Answer);
    assert.deepEqual(
      layer.events.map((event) => event.area),
      ["Scan", "Connection"],
    );
  });
});

describe("createApi: the streamed body", () => {
  it("returns the body untouched, without decoding it as an envelope", async () => {
    const layer = client(async () => new Response("one\ntwo\n", { status: 200 }));
    const body = await layer.apiStream("/api/folders/f-1/scan", { area: "Scan" });
    assert.equal(await new Response(body).text(), "one\ntwo\n");
    assert.equal(layer.events[0]?.area, "Scan");
  });

  it("decodes a streamed refusal through the standard envelope", async () => {
    const layer = client(async () =>
      json({ ok: false, error: { code: "job.not_running", message: "Finished." } }, 409),
    );
    await assert.rejects(layer.apiStream("/api/folders/f-1/scan"), { code: "job.not_running", status: 409 });
    assert.equal(layer.events[0]?.status, 409);
  });

  it("treats a refusal that is not an envelope as the invalid code, keeping the status", async () => {
    const layer = client(async () => new Response("nope", { status: 500 }));
    await assert.rejects(layer.apiStream("/api/folders/f-1/scan"), { code: "backend.bad_response", status: 500 });
  });

  it("treats a success with no body as the invalid code, reported invalid", async () => {
    const layer = client(async () => new Response(null, { status: 200 }));
    await assert.rejects(layer.apiStream("/api/folders/f-1/scan"), { code: "backend.bad_response", status: 200 });
    assert.equal(layer.events[0]?.status, "invalid");
  });
});
