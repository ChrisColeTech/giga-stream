import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { providerChanges, providerCreateBody } from "@/lib/provider-body";
import { draftOfProvider } from "@/lib/provider-draft";
import { providers } from "@/services/providers";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const provider = (id: number, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id,
  name: `P${id}`,
  source: `p${id}`,
  is_active: true,
  order: id,
  family: "embed",
  movieTemplate: "https://p.example.test/movie/{tmdbId}",
  origin: "https://p.example.test",
  frameOrigins: ["https://cdn.example.test"],
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});
const refusal = (status: number, code: string, field?: string) =>
  json({ ok: false, error: { code, message: "Server sentence.", ...(field && { details: { field } }) } }, status);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the providers service", () => {
  it("lists /api/admin/providers with the bearer, dropping and counting a row it cannot read", async () => {
    await withBackend(
      () => success({ items: [provider(1), { id: "broken" }, provider(2)] }),
      async (calls) => {
        const list = await providers.list();
        assert.equal(calls[0]?.url, "/api/admin/providers");
        assert.equal(calls[0]?.headers["authorization"], "Bearer a");
        assert.deepEqual([list.items.map((item) => item.id), list.unreadable], [[1, 2], 1]);
      },
    );
  });

  it("posts the create body", async () => {
    await withBackend(
      () => success(provider(9), 201),
      async (calls) => {
        const draft = { name: " New ", family: "embed" as const, source: "new", movieTemplate: "" };
        await providers.create(providerCreateBody(draft));
        assert.equal(calls[0]?.method, "POST");
        assert.deepEqual(calls[0]?.body, { name: "New", source: "new", family: "embed" });
      },
    );
  });

  it("saves by PUT with only the changed fields, null clearing an emptied one, enabled round-tripping", async () => {
    const saved = provider(3);
    await withBackend(
      () => success({ ...saved, is_active: false, origin: undefined }),
      async (calls) => {
        const draft = { ...draftOfProvider(saved), enabled: false, origin: "  " };
        const answer = await providers.update(3, providerChanges(saved, draft));
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["PUT", "/api/admin/providers/3"]);
        assert.deepEqual(calls[0]?.body, { enabled: false, origin: null });
        assert.equal(answer.is_active, false);
      },
    );
  });

  it("deletes by id", async () => {
    await withBackend(
      () => success({ id: 4 }),
      async (calls) => {
        assert.deepEqual(await providers.remove(4), { id: 4 });
        assert.deepEqual([calls[0]?.method, calls[0]?.url], ["DELETE", "/api/admin/providers/4"]);
      },
    );
  });

  it("carries the field of a 422 provider.invalid", async () => {
    await withBackend(
      () => refusal(422, "provider.invalid", "frameOrigins.8"),
      async () => {
        await assert.rejects(providers.update(1, { frameOrigins: [] }), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.deepEqual([error.code, error.status, error.field], ["provider.invalid", 422, "frameOrigins.8"]);
          return true;
        });
      },
    );
  });

  it("answers backend.bad_response when a write answer cannot be read", async () => {
    await withBackend(
      () => success({ nope: 1 }),
      async () => {
        await assert.rejects(providers.create({ name: "A", source: "a" }), { code: "backend.bad_response" });
      },
    );
  });
});
