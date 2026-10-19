import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { useTitleAdd, type TitleAdd } from "@/hooks/useTitleAdd";
import { useTitleBrowseRowView } from "@/hooks/useTitleBrowseRowView";
import { addBulkReason, addReason, addSkip, openReason, planTitleAdd } from "@/lib/title-browse";
import { START_VIEW } from "@/lib/title-query";
import { TitlesPage } from "@/pages/TitlesPage";
import { TitleRowSchema, type AdminTitleRow } from "@/services/schemas/title-schema";
import { ApiError } from "@giga/http/api-error";
import { createTitleAddCall } from "@/services/title-add-call";
import { useAppStore } from "@/store/app-store";
import { failure, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { renderLive, resetStore, signInForTest } from "./support/store";
import { INVENTORY } from "./support/titles-stored-kit";

const state = () => useAppStore.getState();
const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: "movie",
  title: `T ${id}`,
  year: 1999,
  state: "synced",
  stored: false,
  deleted: false,
  ...extra,
});
const IDLE = { busy: false, unreachable: false };
const page = (): string => {
  state().storedSetMode("browse");
  return renderLive(createElement(TitlesPage, { active: true }));
};
const loaded = (items: AdminTitleRow[]): void => {
  state().titlesReset(state().serial);
  state().titlesLoaded(START_VIEW, { items, page: 1, totalPages: 1, totalResults: items.length });
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the Browse answer's rows", () => {
  it("reads stored and deleted when TMDB's row carries them, and a stored list row without them", () => {
    const parsed = TitleRowSchema.parse({ id: "movie-1", kind: "movie", title: "A", state: "synced", stored: true, deleted: false });
    assert.deepEqual([parsed.stored, parsed.deleted], [true, false]);
    const plain = TitleRowSchema.parse({ id: "movie-2", kind: "movie", title: "B", state: "edited" });
    assert.deepEqual([plain.stored, plain.deleted], [undefined, undefined]);
    assert.equal(TitleRowSchema.safeParse({ id: "movie-3", kind: "movie", title: "C", state: "synced", stored: "yes" }).success, false);
  });
});

describe("the state word and the dimming", () => {
  it("says stored or deleted and dims the row; a title the store lacks has no word and is not dimmed", () => {
    loaded([row("movie-1", { stored: true }), row("movie-2", { deleted: true }), row("movie-3")]);
    const html = page();
    assert.ok(html.includes('data-st="stored"') && html.includes('data-st="deleted"'));
    const dimmed = html.match(/<li[^>]*opacity-45/g) ?? [];
    assert.equal(dimmed.length, 2, "exactly the two known rows are dimmed");
    assert.ok(dimmed.every((li) => li.includes("data-st=")));
    assert.ok(!html.includes('data-st="synced"'));
  });
});

describe("the Add verb", () => {
  it("is an icon and a word on the row; enabled for a new title, disabled with its reason otherwise", () => {
    loaded([row("movie-1"), row("movie-2", { stored: true }), row("movie-3", { deleted: true })]);
    const html = page();
    assert.ok(html.includes('title="Add this title to the store"') && html.includes('aria-label="Add T movie-1"'));
    assert.ok(html.includes('aria-label="Add T movie-2. Already stored."'));
    assert.ok(html.includes('aria-label="Add T movie-3. Deleted earlier; restore it under Deleted titles."'));
  });

  it("gives its reasons: busy, unreachable, and the row's own first", () => {
    assert.equal(addReason(row("movie-1"), IDLE), undefined);
    assert.equal(addReason(row("movie-1"), { busy: true, unreachable: false }), "Adding.");
    assert.equal(addReason(row("movie-1"), { busy: false, unreachable: true }), "The admin backend cannot be reached.");
    assert.equal(addReason(row("movie-1", { stored: true }), { busy: true, unreachable: true }), "Already stored.");
    assert.equal(addSkip(row("movie-1", { stored: true, deleted: true })), "Deleted earlier; restore it under Deleted titles.");
  });

  it("plans the selection: new titles run, stored and deleted ones are refused; the strip's Add says why it waits", () => {
    const items = [row("movie-1"), row("movie-2", { stored: true }), row("movie-3", { deleted: true })];
    const plan = planTitleAdd(items, ["movie-1", "movie-2", "movie-3"]);
    assert.deepEqual(plan.runnable.map((one) => one.id), ["movie-1"]);
    assert.deepEqual(plan.refused.map((one) => one.reason), ["Already stored.", "Deleted earlier; restore it under Deleted titles."]);
    assert.equal(addBulkReason(planTitleAdd(items, []), 0, IDLE), "Tick a row first");
    assert.equal(addBulkReason(planTitleAdd(items, ["movie-2"]), 1, IDLE), "Already stored.");
    assert.equal(addBulkReason(plan, 3, { busy: true, unreachable: false }), "Adding.");
    assert.equal(addBulkReason(plan, 3, IDLE), undefined);
  });

  it("is enabled in the strip for a ticked new title and refused for a ticked stored one", () => {
    loaded([row("movie-1"), row("movie-2", { stored: true })]);
    state().titleTick("movie-1", true);
    const enabled = page();
    assert.ok(enabled.includes('title="Add the ticked titles to the store"') && enabled.includes(">Add</button>"));
    state().titleTick("movie-1", false);
    state().titleTick("movie-2", true);
    assert.ok(page().includes('aria-label="Add. Already stored."'));
  });
});

describe("what an add does", () => {
  const rig = () => {
    loaded([row("movie-1"), row("movie-2")]);
    state().storedSetMode("browse");
    return createTitleAddCall({ service: { addFromTmdb: async (id) => ({ ...row(id), stored: undefined }) }, store: state });
  };

  it("marks the row stored and the Stored list stale on success", async () => {
    state().storedPageLoaded("k", 0, { rows: [], total: 0, version: "5:1", inventory: INVENTORY });
    const add = rig();
    assert.equal(await add({ id: "movie-1", label: "T movie-1" }), null);
    assert.deepEqual(state().titles.items.map((one) => one.stored), [true, false]);
    assert.equal(state().titlesStored.status, "idle");
  });

  it("words 409, 404 and 422 from the error table and leaves the row alone", async () => {
    const cases: ReadonlyArray<readonly [number, string, string]> = [
      [409, "title.taken", "That title is already stored, or it was deleted; restore it under Deleted titles."],
      [404, "title.not_found", "That title does not exist."],
      [422, "title.invalid", "That title is not valid."],
    ];
    for (const [status, code, sentence] of cases) {
      const add = createTitleAddCall({
        service: { addFromTmdb: async () => Promise.reject(new ApiError(code, sentence, status)) },
        store: state,
      });
      loaded([row("movie-1")]);
      assert.equal(await add({ id: "movie-1", label: "T" }), sentence, code);
      assert.equal(state().titles.items[0]?.stored, false);
    }
  });
});

describe("the add through the real service", () => {
  const probe = (): { add: () => TitleAdd; view: () => (t: AdminTitleRow) => RecordRowView } => {
    let add: TitleAdd | undefined;
    let view: ((t: AdminTitleRow) => RecordRowView) | undefined;
    renderLive(
      createElement(function Probe() {
        add = useTitleAdd();
        const make = useTitleBrowseRowView(add, false);
        view = (title) => make(title, false, () => undefined);
        return null;
      }),
    );
    return {
      add: () => add ?? assert.fail("no add"),
      view: () => view ?? assert.fail("no view"),
    };
  };

  it("posts one id per title, in order, and says one summary; a 409 is a skip-worthy failure that does not stop the rest", async () => {
    loaded([row("movie-1"), row("movie-2")]);
    state().titleTick("movie-1", true);
    state().titleTick("movie-2", true);
    const { add } = probe();
    const ids: unknown[] = [];
    await withBackend(
      (call) => {
        ids.push(call.body);
        const id = (call.body as { id: string }).id;
        return id === "movie-1" ? failure(409, "title.taken", "x") : success(row(id), 201);
      },
      async () => {
        add().verb.onPress();
        await new Promise((resolve) => setTimeout(resolve, 20));
      },
    );
    assert.deepEqual(ids, [{ id: "movie-1" }, { id: "movie-2" }]);
    assert.deepEqual(state().titles.items.map((one) => one.stored), [false, true]);
    assert.equal(state().notice?.sentence, "Added 1 title; 1 failed.");
  });

  it("opening a row that is not stored makes no detail call and opens nothing; a stored row opens", async () => {
    loaded([row("movie-1"), row("movie-2", { stored: true }), row("movie-3", { deleted: true })]);
    const { view } = probe();
    await withBackend(
      () => failure(404, "title.not_found", "no"),
      async (calls) => {
        view()(row("movie-1")).onOpen?.();
        assert.equal(state().workspaces.titles, null);
        assert.equal(state().events.at(-1)?.sentence, "T movie-1: Not stored yet. Add it to open it.");
        view()(row("movie-3", { deleted: true })).onOpen?.();
        assert.equal(state().workspaces.titles, null);
        assert.equal(calls.length, 0, "no GET /api/titles/:id for an unstored row");
        view()(row("movie-2", { stored: true })).onOpen?.();
        assert.equal(state().workspaces.titles, "movie-2");
      },
    );
    assert.equal(openReason(row("movie-2", { stored: true })), undefined);
  });
});
