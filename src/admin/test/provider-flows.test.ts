import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { draftOfProvider, EMPTY_NEW_PROVIDER } from "@/lib/provider-draft";
import { createProviderFlows } from "@/services/provider-flows";
import type { ProvidersService } from "@/services/providers";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const provider = (id: number, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id,
  name: `P${id}`,
  source: `p${id}`,
  is_active: true,
  order: id,
  family: "stream",
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});
const refuse = (code: string, status: number, field?: string) =>
  new ApiError(code, `sentence for ${code}`, status, field === undefined ? {} : { field });
const notice = (): string => state().notice?.sentence ?? "";

type Script = Partial<ProvidersService>;

function rig(script: Script = {}) {
  const calls: string[] = [];
  const reloads: Array<number | undefined> = [];
  const service: ProvidersService = {
    list: async () => (calls.push("list"), { items: [provider(1), provider(2)], unreadable: 0 }),
    create: async (input) => (calls.push("create"), provider(9, { name: String(input["name"]) })),
    update: async (id, body) => (calls.push(`update:${id}:${JSON.stringify(body)}`), provider(id, { name: "saved" })),
    remove: async (id) => (calls.push(`remove:${id}`), { id }),
    ...script,
  };
  const flows = createProviderFlows({
    service,
    store: () => useAppStore.getState(),
    audit: { reload: async (limit) => void reloads.push(limit) },
  });
  return { flows, calls, reloads };
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("load", () => {
  it("fills the list and says how many rows were unreadable", async () => {
    const { flows } = rig({ list: async () => ({ items: [provider(2), provider(1)], unreadable: 2 }) });
    await flows.load();
    assert.deepEqual(state().providers.items.map((p) => p.id), [1, 2]);
    assert.equal(notice(), "2 providers could not be read.");
  });

  it("marks the backend unreachable on a transport failure, keeping the last rows", async () => {
    state().providersLoaded([provider(1)]);
    const { flows } = rig({ list: async () => Promise.reject(refuse("backend.unreachable", 0)) });
    const result = await flows.load();
    assert.equal(result.ok, false);
    assert.deepEqual([state().providers.status, state().providers.unreachable, state().providers.items.length], ["failed", true, 1]);
  });

  it("drops a late answer from an earlier session (serial)", async () => {
    let release: () => void = () => undefined;
    const { flows } = rig({
      list: () => new Promise((resolve) => (release = () => resolve({ items: [provider(5)], unreadable: 0 }))),
    });
    const pending = flows.load();
    useAppStore.setState({ serial: 2 });
    release();
    assert.deepEqual(await pending, { ok: false, sentence: "", dropped: true });
    assert.deepEqual(state().providers.items, []);
  });
});

describe("create", () => {
  it("upserts, says Created and reloads the audit tail", async () => {
    const { flows, reloads } = rig();
    const result = await flows.create({ ...EMPTY_NEW_PROVIDER, name: "New", source: "new", family: "stream" });
    assert.equal(result.ok, true);
    assert.ok(state().providers.items.some((p) => p.name === "New"));
    assert.equal(notice(), "Created New.");
    assert.deepEqual(reloads, [10]);
  });

  it("puts a backend 422 under its row", async () => {
    const { flows } = rig({ create: async () => Promise.reject(refuse("provider.invalid", 422, "movieTemplate")) });
    const draft = { name: "A", family: "embed" as const, source: "a", movieTemplate: "https://x.test/{tmdbId}" };
    assert.deepEqual(await flows.create(draft), {
      ok: false,
      sentence: "sentence for provider.invalid",
      field: "movieTemplate",
    });
  });

  it("refuses a bad template before sending anything", async () => {
    const { flows, calls } = rig();
    const result = await flows.create({ name: "A", family: "embed", source: "a", movieTemplate: "http://x.test" });
    assert.equal(result.ok === false && result.field, "movieTemplate");
    assert.deepEqual(calls, []);
  });
});

describe("save and remove", () => {
  it("sends only the changed fields and answers the saved provider; nothing changed sends nothing", async () => {
    state().providersLoaded([provider(1), provider(2)]);
    const { flows, calls } = rig();
    assert.deepEqual(await flows.save(1, draftOfProvider(provider(1))), { ok: true, value: null });
    const result = await flows.save(1, { ...draftOfProvider(provider(1)), enabled: false, startParam: "t" });
    assert.ok(result.ok && result.value?.name === "saved");
    assert.deepEqual(calls, ['update:1:{"enabled":false,"startParam":"t"}']);
    assert.equal(notice(), "Saved saved.");
  });

  it("closes the workspace and re-reads when the provider is gone", async () => {
    state().providersLoaded([provider(1)]);
    state().openWorkspace("providers", "1");
    const { flows, calls } = rig({ update: async () => Promise.reject(refuse("provider.not_found", 404)) });
    await flows.save(1, { ...draftOfProvider(provider(1)), name: "x" });
    assert.equal(state().workspaces.providers, null);
    assert.ok(calls.includes("list"));
  });

  it("removes on the answer and closes its open workspace", async () => {
    state().providersLoaded([provider(1), provider(2)]);
    state().openWorkspace("providers", "2");
    const { flows } = rig();
    await flows.remove(2);
    assert.deepEqual([state().providers.items.map((p) => p.id), state().workspaces.providers], [[1], null]);
    assert.equal(notice(), "Deleted P2.");
  });

  it("drops a save answered after sign-out", async () => {
    state().providersLoaded([provider(1)]);
    let release: () => void = () => undefined;
    const { flows } = rig({ update: () => new Promise((resolve) => (release = () => resolve(provider(1, { name: "late" })))) });
    const pending = flows.save(1, { ...draftOfProvider(provider(1)), name: "late" });
    state().signOut();
    release();
    assert.equal((await pending).ok, false);
    assert.ok(!state().providers.items.some((p) => p.name === "late"));
  });
});
