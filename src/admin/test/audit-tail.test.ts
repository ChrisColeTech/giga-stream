import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { EVENT_LOG_LIMIT, type EventRow } from "@giga/ui/lib/event-log";
import { mergeAudit, oldestAuditId } from "@/lib/audit-merge";
import { audit } from "@/services/audit";
import type { AuditPage } from "@/services/schemas/audit-schema";
import { createAuditTail } from "@/services/audit-tail";
import { useAppStore } from "@/store/app-store";
import type { AuditEntry } from "@/types/admin-audit";
import type { EventArea } from "@/types/events";
import { success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const entry = (id: number, extra: Partial<AuditEntry> = {}): AuditEntry => ({
  id,
  at: id * 1000,
  actorUsername: "ada@example.test",
  action: "account.created",
  subject: `acct_${id}`,
  detail: { username: `u${id}@x.test` },
  ...extra,
});
/* The backend answers newest first. */
const page = (ids: number[], nextBefore?: number): AuditPage => ({
  items: ids.map((id) => entry(id)),
  unreadable: 0,
  ...(nextBefore !== undefined && { nextBefore }),
});

function fakeService(pages: Array<AuditPage | Error>) {
  const queries: Array<{ limit?: number; before?: number }> = [];
  return {
    queries,
    list: async (query: { limit?: number; before?: number } = {}) => {
      queries.push(query);
      const next = pages.shift();
      if (next === undefined) throw new Error("no page scripted");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}
const tailOf = (service: ReturnType<typeof fakeService>) =>
  createAuditTail({ service, store: () => useAppStore.getState() });
const ids = (): string[] => state().events.map((row) => row.id);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the audit tail", () => {
  it("puts the newest entry at the foot and de-duplicates by id", async () => {
    const service = fakeService([page([3, 2, 1], 1), page([4, 3], 1)]);
    const tail = tailOf(service);
    await tail.reload();
    assert.deepEqual(ids(), ["audit-1", "audit-2", "audit-3"]);
    await tail.reload(10);
    assert.deepEqual(ids(), ["audit-1", "audit-2", "audit-3", "audit-4"]);
    assert.deepEqual(service.queries, [{ limit: 50 }, { limit: 10 }]);
  });

  it("sets the cursor on the first reload only, and Load older always sets it", async () => {
    const service = fakeService([page([9, 8], 8), page([20, 9], 3), page([7, 6], 6), page([5])]);
    const tail = tailOf(service);
    await tail.reload();
    assert.equal(state().olderCursor, 8);
    await tail.reload(10);
    assert.equal(state().olderCursor, 8, "a later reload leaves the cursor");
    await tail.loadOlder();
    assert.equal(state().olderCursor, 6);
    await tail.loadOlder();
    assert.equal(state().olderCursor, null, "the first entry was reached");
  });

  it("asks Load older for the entries before the smallest audit id held", async () => {
    const service = fakeService([page([30, 20], 20), page([10], undefined)]);
    const tail = tailOf(service);
    await tail.reload();
    await tail.loadOlder();
    assert.deepEqual(service.queries[1], { limit: 50, before: 20 });
    assert.deepEqual(ids(), ["audit-10", "audit-20", "audit-30"]);
  });

  it("does nothing without a cursor", async () => {
    const service = fakeService([page([2, 1])]);
    const tail = tailOf(service);
    await tail.reload();
    assert.equal(state().olderCursor, null);
    await tail.loadOlder();
    assert.equal(service.queries.length, 1, "no request");
  });

  it("keeps local rows and interleaves them by time", async () => {
    state().say("Created x.", "warn", "Account");
    const local = state().events[0] as EventRow<EventArea>;
    useAppStore.setState({ events: [{ ...local, at: 2500 }] });
    await tailOf(fakeService([page([3, 2, 1])])).reload();
    assert.deepEqual(ids().map((id) => (id === local.id ? "local" : id)), ["audit-1", "audit-2", "local", "audit-3"]);
  });

  it("says a refusal once as a warn notice and changes nothing else", async () => {
    const tail = tailOf(fakeService([new ApiError("backend.unreachable", "The admin backend cannot be reached.")]));
    await tail.reload();
    assert.equal(state().notice?.sentence, "The admin backend cannot be reached.");
    assert.equal(state().notice?.tone, "warn");
    assert.equal(state().events.length, 1);
    assert.equal(state().olderCursor, null);
  });

  it("drops an answer that lands after the session ended or changed", async () => {
    let release: (value: AuditPage) => void = () => undefined;
    const slow = {
      list: () => new Promise<AuditPage>((resolve) => void (release = resolve)),
    };
    const pending = createAuditTail({ service: slow, store: () => useAppStore.getState() }).reload();
    state().signOut();
    release(page([2, 1]));
    await pending;
    assert.deepEqual(state().events, []);
  });

  it("names accounts by the held username and never shows a password field", async () => {
    state().accountsLoaded([{ id: "acct_5", username: "held@x.test", name: "H", disabled: false, createdAt: 1, updatedAt: 1 }]);
    const updated = entry(5, { action: "account.updated", detail: { name: "Hal", fields: ["name"], password: "hunter2" } });
    await tailOf(fakeService([{ items: [updated], unreadable: 0 }])).reload();
    assert.equal(state().events[0]?.sentence, "ada@example.test updated account held@x.test");
    assert.ok(!JSON.stringify(state().events).includes("hunter2"));
  });

  it("holds no async action in the store", () => {
    assert.ok(!("loadAudit" in state()) && !("loadOlder" in state()));
    assert.equal(typeof state().takeAudit, "function");
  });
});

describe("the merge", () => {
  it("caps at 200 rows: a reload drops the oldest, Load older drops the newest", () => {
    const held = mergeAudit([], Array.from({ length: 200 }, (_, i) => entry(300 - i)), {}, "reload");
    assert.equal(held.length, EVENT_LOG_LIMIT);
    const reloaded = mergeAudit(held, [entry(301)], {}, "reload");
    assert.deepEqual([reloaded.length, reloaded[0]?.id, reloaded.at(-1)?.id], [200, "audit-102", "audit-301"]);
    const older = mergeAudit(held, [entry(50)], {}, "older");
    assert.deepEqual([older.length, older[0]?.id, older.at(-1)?.id], [200, "audit-50", "audit-299"]);
    assert.equal(oldestAuditId(held), 101);
  });
});

describe("the audit service", () => {
  it("builds the query, reads entry by entry and counts an unreadable one", async () => {
    signInForTest();
    await withBackend(
      () => success({ items: [entry(2), { nope: true }, entry(1)], nextBefore: 1 }),
      async (calls) => {
        const result = await audit.list({ limit: 10, before: 5 });
        assert.equal(calls[0]?.url, "/api/audit?limit=10&before=5");
        assert.deepEqual([result.items.map((item) => item.id), result.unreadable, result.nextBefore], [[2, 1], 1, 1]);
      },
    );
  });
});
