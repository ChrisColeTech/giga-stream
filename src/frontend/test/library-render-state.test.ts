import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { requestVisiblePageOnce } from "@/components/library/LibraryPager";
import { collectionsSubmenu, FOLDER_MEMBERSHIP_REASON } from "@/lib/collection-menu";
import { memberRows } from "@/lib/collections-members";
import { libraryRenderState, rowsRenderState } from "@/lib/library-render-state";
import type { ResolvedItem } from "@/lib/library-marks";
import { useAppStore } from "@/store/app-store";

const movie: ResolvedItem = {
  ref: { kind: "title", id: "movie-1" }, kind: "movie", title: "Movie", genres: [], favorite: false,
  collectionIds: [], collectionSources: {},
};
const local: ResolvedItem = {
  ref: { kind: "local", id: "local-1" }, kind: "local", title: "Local", genres: [], favorite: false,
  collectionIds: [], collectionSources: {},
};
const collection = { id: "c1", name: "One", type: "movie" as const, total: 1, manual: 1, folders: 0, scan: "idle" as const };

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

describe("backend-down Library rendering", () => {
  it("keeps local rows and skeletonizes unavailable title regions", () => {
    assert.deepEqual(libraryRenderState([movie, local], false, "all"), {
      items: [local], titleRegionsLoading: true,
    });
  });

  it("does not skeletonize an explicitly local-only query", () => {
    assert.deepEqual(libraryRenderState([local], false, "local"), {
      items: [local], titleRegionsLoading: false,
    });
    assert.deepEqual(libraryRenderState([movie, local], true, "all").items, [movie, local]);
  });
});

describe("Rows paging grammar", () => {
  it("keeps established skeletons for pending and settled empty Rows", () => {
    assert.deepEqual(rowsRenderState(0, true, false), { showSkeleton: true, showPager: true });
    assert.deepEqual(rowsRenderState(0, false, false), { showSkeleton: true, showPager: false });
    assert.equal(libraryRenderState([], false, "all").titleRegionsLoading, true);
  });

  it("requests a visible cursor only once until the active request clears", () => {
    const active = { current: false };
    let requests = 0;
    const request = () => { requests += 1; };
    requestVisiblePageOnce(active, request);
    requestVisiblePageOnce(active, request);
    assert.equal(requests, 1);
    active.current = false;
    requestVisiblePageOnce(active, request);
    assert.equal(requests, 2);
  });
});

describe("membership sources", () => {
  it("keeps folder membership checked and disables its delete with the documented reason", () => {
    const submenu = collectionsSubmenu([collection], () => "folder", () => assert.fail("must stay disabled"));
    const row = submenu.items[0];
    assert.equal(row?.kind, "action");
    if (row?.kind !== "action") return;
    assert.equal(row.checked, true);
    assert.equal(row.disabled, true);
    assert.equal(row.disabledReason, FOLDER_MEMBERSHIP_REASON);
  });

  it("keeps manual membership checked and removable", () => {
    const submenu = collectionsSubmenu([collection], () => "manual", () => undefined);
    const row = submenu.items[0];
    assert.equal(row?.kind, "action");
    if (row?.kind !== "action") return;
    assert.equal(row.checked, true);
    assert.equal(row.disabled, false);
  });

  it("passes collectionSource into member-table rows", () => {
    const item = { ...movie, collectionSource: "folder" as const, posterUrl: "/api/images/one" };
    assert.equal(memberRows([item.ref], [item])[0]?.source, "folder");
  });
});

describe("collection request tokens", () => {
  it("accepts a successful sibling and refuses an older collection answer", () => {
    const first = useAppStore.getState().beginCollectionsRead();
    const second = useAppStore.getState().beginCollectionsRead();
    const answer = [{
      id: "c1", name: "One", type: "movie" as const, itemCount: 1, folders: [], scanning: false,
      createdAt: 1, updatedAt: 2,
    }];
    assert.equal(useAppStore.getState().acceptCollectionsRead(first, answer), false);
    assert.equal(useAppStore.getState().acceptCollectionsRead(second, answer), true);
    assert.deepEqual(useAppStore.getState().collections, answer);
  });
});
