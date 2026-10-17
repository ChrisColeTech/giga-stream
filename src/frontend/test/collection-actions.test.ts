import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { recoverMissingScan } from "@/hooks/useCollectionsData";
import { ApiError } from "@/services/api";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const collection = {
  id: "c-1",
  name: "Films",
  type: "local",
  itemCount: 0,
  folders: [],
  scanning: false,
  createdAt: 1,
  updatedAt: 1,
} as const;
const folder = { id: "f-1", collectionId: "c-1", name: "Films", fileCount: 0, scanning: true } as const;

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const success = (data: unknown): Response => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

describe("collection action recovery", () => {
  it("refreshes collections and jobs once when scan acquisition returns 409", async () => {
    let calls = 0;
    globalThis.fetch = async (input) => {
      calls += 1;
      return String(input) === "/api/collections" ? success([collection]) : success([]);
    };
    const recovered = await recoverMissingScan(new ApiError("job.not_running", "Finished.", 409));
    assert.equal(recovered, true);
    assert.equal(calls, 2);
    assert.equal(useAppStore.getState().collections[0]?.scanning, false);
  });

  it("retries a failed initial folder attach against the collection already created", async () => {
    const paths: string[] = [];
    let call = 0;
    globalThis.fetch = async (input) => {
      paths.push(String(input));
      call += 1;
      if (call === 1) return success(collection);
      if (call === 2) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: "fs.invalid_selection", message: "Choose again." } }),
          { status: 422 },
        );
      }
      if (call === 3) return success(folder);
      return success([]);
    };

    const actions = useCollectionVerbs();
    const result = await actions.create("Films", "local", { token: "expired", name: "Films" });
    assert.deepEqual(result, { outcome: "attach-failed", collectionId: "c-1" });
    assert.equal(useAppStore.getState().collections.length, 1);
    assert.match(useAppStore.getState().notice?.sentence ?? "", /was created, but its folder was not attached/);

    assert.equal(await actions.attachSelection("c-1", { token: "fresh", name: "Films" }), true);
    assert.deepEqual(paths, [
      "/api/collections",
      "/api/collections/c-1/folders",
      "/api/collections/c-1/folders",
      "/api/jobs",
    ]);
  });

  it("cancels only the live folder-scan job with the exact folderId", async () => {
    const live = {
      id: "j-live",
      kind: "folder-scan",
      folderId: "f-1",
      label: "Anything",
      state: "running",
      createdAt: 2,
    } as const;
    const settled = { ...live, id: "j-old", state: "done" as const };
    const other = { ...live, id: "j-other", folderId: "f-2" };
    let call = 0;
    globalThis.fetch = async (input) => {
      call += 1;
      if (call === 1) return success([settled, other, live]);
      if (call === 2) {
        assert.equal(input, "/api/jobs/j-live/cancel");
        return success({ ...live, state: "cancelling" });
      }
      return success([{ ...live, state: "cancelling" }]);
    };
    assert.equal(await useCollectionVerbs().cancelScan("f-1"), true);
  });
});
