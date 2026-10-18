import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useAppStore } from "@/store/app-store";
import { tabSlices } from "@/store/slices";
import { createChannelsSlice } from "@/store/slices/channels";
import { createJobsSlice } from "@/store/slices/jobs";
import { createPlaylistsSlice } from "@/store/slices/playlists";
import { createProvidersSlice } from "@/store/slices/providers";
import { createTitlesSlice } from "@/store/slices/titles";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const NEVER = (): never => {
  throw new Error("a placeholder never writes or reads");
};

beforeEach(() => resetStore());

describe("the per-tab slice registry", () => {
  it("returns the accounts slice's state and actions, and the store carries them", () => {
    const slices = tabSlices(NEVER, () => ({ accounts: state().accounts }) as ReturnType<typeof tabSlices>);
    assert.equal(slices.accounts.status, "idle");
    for (const action of ["accountsLoaded", "accountUpsert", "accountRemove", "accountTick", "accountsTickAll"] as const) {
      assert.equal(typeof slices[action], "function", action);
    }
    assert.equal(state().accounts.status, "idle");
  });

  it("adds no key for a placeholder tab", () => {
    for (const make of [createChannelsSlice, createProvidersSlice, createTitlesSlice, createPlaylistsSlice, createJobsSlice]) {
      assert.deepEqual(make(NEVER, NEVER), {});
    }
  });
});

describe("the stale registry", () => {
  it("marks and clears one tab without touching the others", () => {
    assert.ok(Object.values(state().stale).every((flag) => !flag));
    state().markStale("playlists");
    assert.equal(state().stale.playlists, true);
    assert.equal(state().stale.jobs, false);
    state().clearStale("playlists");
    assert.equal(state().stale.playlists, false);
  });

  it("is reset on sign-out", () => {
    state().beginSignIn();
    state().finishSignIn({
      ok: true,
      session: {
        actor: { id: 1, email: "a@b.test", name: "A" },
        tokens: { accessToken: "a", accessExpiresAt: 9e12, refreshToken: "r", refreshExpiresAt: 9e12 },
      },
    });
    state().markStale("titles");
    state().signOut();
    assert.equal(state().stale.titles, false);
  });
});
