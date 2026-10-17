import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  changeFavourite,
  changeMembership,
  clearWatchHistory,
  loadMemberships,
  removeWatchEntry,
} from "@/components/library/library-service";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const success = (data: unknown): Response => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const refusal = (message: string): Response => new Response(JSON.stringify({
  ok: false, error: { code: "request.refused", message },
}), { status: 409 });
const collection = (itemCount: number) => ({
  id: "c1", name: "One", type: "movie", itemCount, folders: [], scanning: false, createdAt: 1, updatedAt: 2,
});

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => { globalThis.fetch = originalFetch; });

describe("optimistic favorites", () => {
  it("applies immediately, then rolls back and reports a refusal", async () => {
    let rejectRequest: ((value: Response) => void) | undefined;
    globalThis.fetch = async () => new Promise((resolve) => { rejectRequest = resolve; });
    const ref = { kind: "title" as const, id: "favorite-rollback" };
    const pending = changeFavourite(ref, true);
    assert.equal(useAppStore.getState().marks.favourites["title:favorite-rollback"], true);
    rejectRequest?.(refusal("Favorite refused."));
    await pending;
    assert.equal(useAppStore.getState().marks.favourites["title:favorite-rollback"], false);
    assert.equal(useAppStore.getState().notice?.sentence, "Favorite refused.");
  });

  it("serializes rapid toggles so the newest intent is persisted last", async () => {
    const requests: Array<{ method?: string; resolve: (value: Response) => void }> = [];
    globalThis.fetch = async (_input, init) => new Promise((resolve) => requests.push({ method: init?.method, resolve }));
    const ref = { kind: "title" as const, id: "favorite-race" };
    const first = changeFavourite(ref, true);
    const second = changeFavourite(ref, false);
    assert.equal(useAppStore.getState().marks.favourites["title:favorite-race"], false);
    assert.deepEqual(requests.map((request) => request.method), ["PUT"]);
    requests[0]?.resolve(success({ ref, favorite: true }));
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(requests.map((request) => request.method), ["PUT", "DELETE"]);
    requests[1]?.resolve(success({ ref, favorite: false }));
    await Promise.all([first, second]);
    assert.equal(useAppStore.getState().marks.favourites["title:favorite-race"], false);
  });
});

describe("optimistic memberships", () => {
  it("rolls back a refused toggle and leaves the collection answer untouched", async () => {
    globalThis.fetch = async () => refusal("Membership refused.");
    const ref = { kind: "title" as const, id: "member-rollback" };
    useAppStore.getState().setMemberships("title:member-rollback", []);
    const pending = changeMembership(ref, "c1", true);
    assert.deepEqual(useAppStore.getState().marks.memberships["title:member-rollback"], ["c1"]);
    await pending;
    assert.deepEqual(useAppStore.getState().marks.memberships["title:member-rollback"], []);
    assert.equal(useAppStore.getState().notice?.sentence, "Membership refused.");
  });

  it("does not let an older membership read overwrite a newer toggle", async () => {
    let resolveRead: ((value: Response) => void) | undefined;
    let membershipReads = 0;
    globalThis.fetch = async (input) => {
      if (String(input).startsWith("/api/items/")) {
        membershipReads += 1;
        if (membershipReads === 1) return new Promise((resolve) => { resolveRead = resolve; });
        return success({ memberships: [{ collectionId: "c1", source: "manual" }] });
      }
      return success(collection(1));
    };
    const ref = { kind: "title" as const, id: "member-stale" };
    const read = loadMemberships(ref);
    await changeMembership(ref, "c1", true);
    resolveRead?.(success({ memberships: [] }));
    assert.deepEqual(await read, [{ collectionId: "c1", source: "manual" }]);
    assert.deepEqual(useAppStore.getState().marks.memberships["title:member-stale"], ["c1"]);
  });

  it("reconciles a manual delete that remains folder-derived", async () => {
    const ref = { kind: "title" as const, id: "member-folder" };
    useAppStore.getState().setMemberships("title:member-folder", [{ collectionId: "c1", source: "manual" }]);
    globalThis.fetch = async (input) => String(input).startsWith("/api/items/")
      ? success({ memberships: [{ collectionId: "c1", source: "folder" }] }) : success(collection(1));
    await changeMembership(ref, "c1", false);
    assert.deepEqual(useAppStore.getState().marks.memberships["title:member-folder"], ["c1"]);
    assert.equal(useAppStore.getState().marks.membershipSources["title:member-folder"]?.c1, "folder");
  });

  it("keeps different collection races independent", async () => {
    const pending = new Map<string, (response: Response) => void>();
    globalThis.fetch = async (input) => {
      const path = String(input);
      if (path.startsWith("/api/items/")) {
        return success({ memberships: [{ collectionId: "c2", source: "manual" }] });
      }
      return new Promise((resolve) => pending.set(path, resolve));
    };
    const ref = { kind: "title" as const, id: "member-independent" };
    const first = changeMembership(ref, "c1", true);
    const second = changeMembership(ref, "c2", true);
    pending.get("/api/collections/c2/items")?.(success({ ...collection(1), id: "c2" }));
    await Promise.resolve();
    pending.get("/api/collections/c1/items")?.(refusal("First refused."));
    await Promise.all([first, second]);
    assert.deepEqual(useAppStore.getState().marks.memberships["title:member-independent"], ["c2"]);
    assert.equal(useAppStore.getState().notice?.sentence, "First refused.");
  });
});

describe("optimistic watch deletion", () => {
  it("rolls one removal and a clear back when each route refuses", async () => {
    globalThis.fetch = async () => refusal("History refused.");
    const events: string[] = [];
    assert.equal(await removeWatchEntry("w1", () => events.push("remove"), () => events.push("restore")), false);
    assert.equal(await clearWatchHistory(() => events.push("clear"), () => events.push("restore all")), false);
    assert.deepEqual(events, ["remove", "restore", "clear", "restore all"]);
    assert.equal(useAppStore.getState().notice?.sentence, "History refused.");
  });

  it("requests fresh counts and rows after an accepted clear", async () => {
    globalThis.fetch = async () => success({ cleared: 3 });
    const before = useAppStore.getState().libraryRefreshSerial;
    assert.equal(await clearWatchHistory(), true);
    assert.equal(useAppStore.getState().libraryRefreshSerial, before + 1);
  });
});
