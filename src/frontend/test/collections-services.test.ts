import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  addMember,
  createCollection,
  listCollections,
  readMemberships,
  removeCollection,
  removeMember,
  updateCollection,
} from "@/services/collections";
import { attachFolder, detachFolder, replaceFolder, rescanFolder } from "@/services/folders";
import { cancelJob, dismissJob, listJobs } from "@/services/jobs";
import { CollectionSchema } from "@/services/schemas/collection-schema";
import { JobSchema } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const collection = {
  id: "c-1",
  name: "Films",
  type: "movie" as const,
  itemCount: 2,
  folders: [],
  scanning: false,
  createdAt: 10,
  updatedAt: 11,
};
const folder = {
  id: "f-1",
  collectionId: "c-1",
  name: "Films",
  fileCount: 2,
  scanning: true,
};
const job = {
  id: "j-1",
  kind: "folder-scan",
  folderId: "f-1",
  label: "Scanning Films",
  state: "running",
  createdAt: 10,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  useAppStore.setState(useAppStore.getInitialState(), true);
});

function answer(data: unknown, inspect?: (input: RequestInfo | URL, init?: RequestInit) => void): typeof fetch {
  return async (input, init) => {
    inspect?.(input, init);
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  };
}

describe("collection routes", () => {
  it("lists and creates with the documented method and body", async () => {
    globalThis.fetch = answer([collection], (input, init) => {
      assert.equal(input, "/api/collections");
      assert.equal(init?.method, "GET");
    });
    assert.deepEqual(await listCollections(), [collection]);

    globalThis.fetch = answer(collection, (input, init) => {
      assert.equal(input, "/api/collections");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)) as unknown, { name: "Films", type: "movie" });
    });
    assert.deepEqual(await createCollection("Films", "movie"), collection);
  });

  it("renames and removes a collection", async () => {
    globalThis.fetch = answer(collection, (input, init) => {
      assert.equal(input, "/api/collections/c-1");
      assert.equal(init?.method, "PATCH");
      assert.deepEqual(JSON.parse(String(init?.body)) as unknown, { name: "Cinema", type: "movie" });
    });
    await updateCollection("c-1", { name: "Cinema", type: "movie" });

    globalThis.fetch = answer({ removed: "c-1" }, (input, init) => {
      assert.equal(input, "/api/collections/c-1");
      assert.equal(init?.method, "DELETE");
    });
    assert.deepEqual(await removeCollection("c-1"), { removed: "c-1" });
  });

  it("adds, removes and reads item membership", async () => {
    const ref = { kind: "title", id: "movie/1" } as const;
    globalThis.fetch = answer(collection, (input, init) => {
      assert.equal(input, "/api/collections/c-1/items");
      assert.equal(init?.method, "PUT");
      assert.deepEqual(JSON.parse(String(init?.body)) as unknown, ref);
    });
    await addMember("c-1", ref);

    globalThis.fetch = answer(collection, (input, init) => {
      assert.equal(input, "/api/collections/c-1/items/title/movie%2F1");
      assert.equal(init?.method, "DELETE");
    });
    await removeMember("c-1", ref);

    globalThis.fetch = answer({ memberships: [{ collectionId: "c-1", source: "folder" }] }, (input) => {
      assert.equal(input, "/api/items/title/movie%2F1/collections");
    });
    assert.deepEqual(await readMemberships(ref), [{ collectionId: "c-1", source: "folder" }]);
  });
});

describe("folder and job routes", () => {
  it("attaches, replaces, rescans and detaches a folder", async () => {
    const cases = [
      [() => attachFolder("c-1", "token"), "/api/collections/c-1/folders", "POST", { token: "token" }, folder],
      [() => replaceFolder("f-1", "next"), "/api/folders/f-1", "PUT", { token: "next" }, folder],
      [() => rescanFolder("f-1"), "/api/folders/f-1/rescan", "POST", undefined, folder],
      [() => detachFolder("f-1"), "/api/folders/f-1", "DELETE", undefined, { removed: "f-1" }],
    ] as const;
    for (const [call, path, method, body, data] of cases) {
      globalThis.fetch = answer(data, (input, init) => {
        assert.equal(input, path);
        assert.equal(init?.method, method);
        if (body !== undefined) assert.deepEqual(JSON.parse(String(init?.body)) as unknown, body);
      });
      await call();
    }
  });

  it("lists, cancels and dismisses jobs", async () => {
    globalThis.fetch = answer([job], (input, init) => {
      assert.equal(input, "/api/jobs");
      assert.equal(init?.method, "GET");
    });
    assert.deepEqual(await listJobs(), [job]);
    globalThis.fetch = answer({ ...job, state: "cancelling" }, (input, init) => {
      assert.equal(input, "/api/jobs/j-1/cancel");
      assert.equal(init?.method, "POST");
    });
    assert.equal((await cancelJob("j-1")).state, "cancelling");
    globalThis.fetch = answer({ removed: "j-1" }, (input, init) => {
      assert.equal(input, "/api/jobs/j-1");
      assert.equal(init?.method, "DELETE");
    });
    assert.deepEqual(await dismissJob("j-1"), { removed: "j-1" });
  });
});

describe("collection and job schemas", () => {
  it("refuses malformed counts and states and strips private folder fields", () => {
    assert.equal(CollectionSchema.safeParse({ ...collection, type: undefined }).success, false);
    assert.equal(CollectionSchema.safeParse({ ...collection, itemCount: -1 }).success, false);
    const parsed = CollectionSchema.safeParse({ ...collection, folders: [{ ...folder, path: "private" }] });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal("path" in parsed.data.folders[0]!, false);
    assert.equal(JobSchema.safeParse({ ...job, state: "unknown" }).success, false);
  });

  it("keeps last good store content when a request is refused", async () => {
    useAppStore.getState().setCollections([collection]);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: { code: "collection.invalid", message: "Refused." } }), {
        status: 422,
      });
    await assert.rejects(listCollections(), /Refused/);
    assert.deepEqual(useAppStore.getState().collections, [collection]);
  });
});
