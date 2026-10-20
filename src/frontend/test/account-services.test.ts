import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { COLLECTIONS_SIGNED_OUT } from "@/lib/collections-copy";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { listCollections, createCollection, readMemberships, removeCollection } from "@/services/collections";
import { writeFavorite } from "@/services/favorites";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

const originalFetch = globalThis.fetch;

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

interface Call {
  readonly input: string;
  readonly method?: string;
  readonly body?: string;
}

function browserWindow(): void {
  (globalThis as { window?: unknown }).window = { localStorage: { getItem: () => null, setItem: () => undefined } };
}

function desktopWindow(): void {
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" }, localStorage: {} };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
});

describe("favorites routed through the resolver (`62` section 3.6)", () => {
  it("signed in, a favourite is put on the account's set", async () => {
    browserWindow();
    useAppStore.setState({ signedIn: true });
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method });
      return success({ ref: { kind: "title", id: "t-1" }, favorite: true });
    };
    await writeFavorite({ kind: "title", id: "t-1" }, true);
    assert.deepEqual(calls, [{ input: "/api/account/favorites/title/t-1", method: "PUT" }]);
  });

  it("signed out, the desktop keeps the fileserver's shared route", async () => {
    desktopWindow();
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method });
      return success({ ref: { kind: "title", id: "t-1" }, favorite: false });
    };
    await writeFavorite({ kind: "title", id: "t-1" }, false);
    assert.deepEqual(calls, [{ input: "/api/favorites/title/t-1", method: "DELETE" }]);
  });

  it("signed out, a browser has no favourites: the refusal is the sentence the press speaks", async () => {
    browserWindow();
    await assert.rejects(
      writeFavorite({ kind: "local", id: "clip-2" }, true),
      (error: unknown) => error instanceof Error && error.message === LIBRARY_COPY.favoritesSignedOut,
    );
  });
});

describe("collections routed through the resolver (`62` section 3.6)", () => {
  it("signed in, the verbs go to the account and its rows read as the app's own", async () => {
    browserWindow();
    useAppStore.setState({ signedIn: true });
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: String(init?.body) });
      return success(calls.length === 1
        ? { items: [{ id: "col-1", name: "Night movies", type: "movie", itemCount: 3, createdAt: 1, updatedAt: 2 }] }
        : { id: "col-2", name: "Rewatch", type: "tv", itemCount: 0, createdAt: 3, updatedAt: 4 });
    };
    const rows = await listCollections();
    const created = await createCollection("Rewatch", "tv");
    assert.deepEqual(calls.map((call) => [call.input, call.method]), [
      ["/api/account/collections", "GET"],
      ["/api/account/collections", "POST"],
    ]);
    assert.deepEqual(created, { id: "col-2", name: "Rewatch", type: "tv", itemCount: 0, folders: [], scanning: false });
    assert.deepEqual(rows, [
      { id: "col-1", name: "Night movies", type: "movie", itemCount: 3, folders: [], scanning: false },
    ]);
  });

  it("signed in, memberships and removals are the account's too", async () => {
    browserWindow();
    useAppStore.setState({ signedIn: true });
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: String(init?.body) });
      return calls.length === 1
        ? success({ memberships: [{ collectionId: "col-1", source: "manual" }] })
        : success({ removed: "col-1" });
    };
    const memberships = await readMemberships({ kind: "title", id: "t-9" });
    const removed = await removeCollection("col-1");
    assert.deepEqual(memberships, [{ collectionId: "col-1", source: "manual" }]);
    assert.deepEqual(removed, { removed: "col-1" });
    assert.deepEqual(calls.map((call) => [call.input, call.method]), [
      ["/api/account/items/title/t-9/collections", "GET"],
      ["/api/account/collections/col-1", "DELETE"],
    ]);
  });

  it("signed out, the desktop keeps the fileserver's shared routes", async () => {
    desktopWindow();
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method });
      return success([]);
    };
    await listCollections();
    assert.deepEqual(calls, [{ input: "/api/collections", method: "GET" }]);
  });

  it("signed out, a browser has no collections: the refusal is the sentence the reads speak", async () => {
    browserWindow();
    await assert.rejects(
      listCollections(),
      (error: unknown) => error instanceof Error && error.message === COLLECTIONS_SIGNED_OUT,
    );
    assert.equal(state().signedIn, false);
  });
});
