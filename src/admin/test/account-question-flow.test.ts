import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { EMPTY_QUESTION_DRAFT, questionStatus, saveQuestionReason } from "@/lib/account-question";
import { createAccountFlows, type AccountFlows } from "@/services/account-flows";
import type { AccountsService } from "@/services/accounts";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { resetStore, signInForTest } from "./support/store";

/* The Security question group's flow (docs/54 section 2): `saveQuestion` sets a selected account's question through
 * `PUT /api/admin-accounts/:id/security-question`, and the pure helpers the group reads. */

const ANSWER = "  Rex  ";
const ME = { id: 7, username: "ada@example.test", disabled: false, createdAt: 1, updatedAt: 1 };
const account = (id: string | number, disabled = false): AdminAccount => ({ ...ME, id, username: `${id}@x.test`, disabled });
const state = () => useAppStore.getState();
const refuse = (code: string, status: number, field?: string) =>
  new ApiError(code, `sentence for ${code}`, status, field === undefined ? {} : { field });

type Script = Partial<{ [K in keyof AccountsService]: AccountsService[K] }>;

function rig(script: Script = {}) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const reloads: Array<number | undefined> = [];
  const service: AccountsService = {
    list: async () => (calls.push("list"), { items: [ME, account("a")], unreadable: 0 }),
    create: async (input) => ({ ...account("n"), username: String(input["username"]) }),
    update: async (id) => ({ ...account(String(id)) }),
    remove: async (id) => ({ id }),
    saveQuestion: async (id, body) => (calls.push(`saveQuestion:${String(id)}`), bodies.push(body), { set: true }),
    ...script,
  };
  const flows: AccountFlows = createAccountFlows({
    service,
    store: () => useAppStore.getState(),
    audit: { reload: async (limit) => void reloads.push(limit) },
  });
  return { flows, calls, bodies, reloads };
}
const loaded = (): void => state().accountsLoaded([ME, account("a")]);
const notice = (): string => state().notice?.sentence ?? "";
/* An info sentence is the newest row of the events drawer, never the notice line (`50` section 2.1). */
const lastEvent = (): string | undefined => state().events.at(-1)?.sentence;

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("save question", () => {
  it("sends the question's number and the answer as typed, flips the row's flag, reloads the audit tail and says nothing", async () => {
    loaded();
    const { flows, calls, bodies, reloads } = rig();
    const result = await flows.saveQuestion("a", 3, ANSWER);
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["saveQuestion:a"]);
    assert.deepEqual(bodies, [{ question: 3, answer: ANSWER }]);
    assert.equal(state().accounts.items.find((item) => String(item.id) === "a")?.securityQuestionSet, true);
    assert.deepEqual(reloads, [10]);
    assert.equal(notice(), "", "a save says nothing; the audit row is the record");
    assert.equal(lastEvent(), undefined);
    assert.ok(!JSON.stringify([state().notice, state().events, state().accounts, state().gate]).includes(ANSWER));
  });

  it("flips the signed-in actor's flag when the account is its own", async () => {
    loaded();
    const { flows } = rig();
    await flows.saveQuestion(7, 1, "rex");
    assert.deepEqual(state().actor, { id: 7, username: "ada@example.test", securityQuestionSet: true });
  });

  it("keeps the held flag when an own-account update does not carry it", () => {
    state().updateActor({ id: 7, username: "ada@example.test", securityQuestionSet: true });
    state().updateActor({ id: 7, username: "ada@new.test" });
    assert.deepEqual(state().actor, { id: 7, username: "ada@new.test", securityQuestionSet: true });
  });

  it("refuses a too-long answer under the row before sending anything", async () => {
    loaded();
    const { flows, calls } = rig();
    const result = await flows.saveQuestion("a", 1, "x".repeat(201));
    assert.deepEqual(
      [result.ok, !result.ok && result.field, !result.ok && result.sentence],
      [false, "answer", "Answer must be at most 200 characters."],
    );
    assert.deepEqual(calls, []);
  });

  it("puts a 422 under the answer or the question row, and says it once on the notice line", async () => {
    loaded();
    const answer = rig({ saveQuestion: async () => Promise.reject(refuse("account.invalid", 422, "answer")) });
    const refused = await answer.flows.saveQuestion("a", 2, "rex");
    assert.deepEqual([refused.ok, !refused.ok && refused.field], [false, "answer"]);
    assert.equal(state().notice?.tone, "warn");
    const question = rig({ saveQuestion: async () => Promise.reject(refuse("account.invalid", 422, "question")) });
    const other = await question.flows.saveQuestion("a", 2, "rex");
    assert.deepEqual([other.ok, !other.ok && other.field], [false, "question"]);
  });

  it("closes the workspace of a gone account with the not-found notice and reads the list again", async () => {
    loaded();
    state().openWorkspace("accounts", "a");
    const gone = rig({ saveQuestion: async () => Promise.reject(refuse("account.not_found", 404)) });
    const result = await gone.flows.saveQuestion("a", 1, "rex");
    assert.deepEqual([result.ok, !result.ok && result.field], [false, undefined]);
    assert.equal(state().workspaces.accounts, null);
    assert.equal(state().notice?.tone, "warn");
    assert.ok(gone.calls.includes("list"), "the list is read again");
  });

  it("marks the backend unreachable on a transport failure", async () => {
    loaded();
    const down = rig({ saveQuestion: async () => Promise.reject(new ApiError("backend.unreachable", "The admin backend cannot be reached.")) });
    await down.flows.saveQuestion("a", 1, "rex");
    assert.equal(state().accounts.unreachable, true);
  });

  it("drops a late answer when the session changed while the call was out", async () => {
    loaded();
    let release: () => void = () => undefined;
    const slow = rig({
      saveQuestion: () =>
        new Promise((resolve) => {
          release = () => resolve({ set: true });
        }),
    });
    const pending = slow.flows.saveQuestion("a", 1, "rex");
    state().signOut();
    release();
    const result = await pending;
    assert.deepEqual([result.ok, !result.ok && result.dropped], [false, true]);
    assert.deepEqual(state().accounts.items, []);
    assert.equal(slow.reloads.length, 0);
  });
});

describe("the group's pure helpers", () => {
  it("names the first missing field, then a running call, then an unreachable backend", () => {
    const draft = { question: "3", answer: "Rex" };
    assert.equal(saveQuestionReason(EMPTY_QUESTION_DRAFT, false, false), "Choose a question.");
    assert.equal(saveQuestionReason({ question: "1", answer: "" }, false, false), "Enter your answer.");
    assert.equal(saveQuestionReason({ question: "1", answer: "  " }, false, false), "Enter your answer.");
    assert.equal(saveQuestionReason(draft, true, false), "Saving.");
    assert.equal(saveQuestionReason(draft, true, true), "Saving.");
    assert.equal(saveQuestionReason(draft, false, true), "The admin backend cannot be reached.");
    assert.equal(saveQuestionReason(draft, false, false), undefined);
  });

  it("words the badge from the account's flag", () => {
    assert.deepEqual([questionStatus(true), questionStatus(false), questionStatus(undefined)], ["Set", "Not set", "Not set"]);
  });
});
