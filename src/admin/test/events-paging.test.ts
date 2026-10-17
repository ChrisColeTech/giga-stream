import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { EVENT_LOG_LIMIT } from "@giga/ui/lib/event-log";
import { signedInFrom } from "@/constants/fixture-switches";
import { OLDER_AUDIT, OLDER_PAGE_SIZE, RECENT_AUDIT, PAGE_EVENTS } from "@/fixtures/audit";
import { FIXTURE_ACTOR, actorFor } from "@/fixtures/session";
import { olderRemaining } from "@/store/audit-slice";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();
const START = RECENT_AUDIT.length + PAGE_EVENTS.length;

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the Events drawer's starting rows", () => {
  it("are the recent audit rows and the page's own, oldest first, with nothing older loaded", () => {
    assert.equal(state().events.length, START);
    assert.equal(state().olderLoaded, 0);
    assert.ok(olderRemaining(0));
  });

  it("are empty before sign-in: the audit log is read after it", () => {
    state().signOut();
    assert.deepEqual(state().events, []);
    state().signIn("ada@example.test");
    assert.equal(state().events.length, START);
  });
});

describe("Load older", () => {
  it("prepends the next four older rows in time order, above the rows already held", () => {
    const first = state().events[0];
    state().loadOlder();
    assert.equal(state().events.length, START + OLDER_PAGE_SIZE);
    assert.equal(state().olderLoaded, OLDER_PAGE_SIZE);
    const ids = state().events.map((row) => row.id);
    const newestOlder = OLDER_AUDIT.slice(-OLDER_PAGE_SIZE).map((entry) => `audit-${entry.id}`);
    assert.deepEqual(ids.slice(0, OLDER_PAGE_SIZE), newestOlder, "the newest four of the older rows, oldest of them first");
    assert.equal(state().events[OLDER_PAGE_SIZE], first, "what was held is untouched below them");
    const times = state().events.map((row) => row.at);
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });

  it("pages until the older rows are gone, then does nothing", () => {
    state().loadOlder();
    state().loadOlder();
    assert.equal(state().olderLoaded, OLDER_AUDIT.length);
    assert.equal(olderRemaining(state().olderLoaded), false);
    assert.equal(state().events[0]?.id, `audit-${OLDER_AUDIT[0]?.id}`, "the oldest row is at the top");
    const before = state().events;
    state().loadOlder();
    assert.equal(state().events, before);
    assert.equal(state().olderLoaded, OLDER_AUDIT.length);
  });

  it("works after Clear, which empties the list on screen only", () => {
    state().clearEvents();
    assert.deepEqual(state().events, []);
    state().loadOlder();
    assert.equal(state().events.length, OLDER_PAGE_SIZE);
  });

  it("lands whole at the 200-row cap, and the next appended row trims the front back to 200", () => {
    const filler = Array.from({ length: EVENT_LOG_LIMIT }, (_, index) => ({
      id: `f-${index}`,
      at: 10_000_000_000_000 + index,
      tone: "info" as const,
      area: "Channel" as const,
      sentence: "filler",
    }));
    useAppStore.setState({ events: filler });
    state().loadOlder();
    assert.equal(state().events.length, EVENT_LOG_LIMIT + OLDER_PAGE_SIZE, "the page is not cut");
    state().logEvent({ tone: "warn", area: "Channel", sentence: "one more" });
    assert.equal(state().events.length, EVENT_LOG_LIMIT);
    assert.equal(state().events.at(-1)?.sentence, "one more", "the newest is at the foot");
  });
});

describe("the session", () => {
  it("signs in as the fixture actor, or as whoever typed an email", () => {
    assert.equal(actorFor("ADA@example.test "), FIXTURE_ACTOR);
    assert.deepEqual(actorFor(" ed@example.test"), { email: "ed@example.test", name: "ed" });
    state().signOut();
    assert.equal(state().actor, null);
    state().signIn("ed@example.test");
    assert.equal(state().signedIn, true);
    assert.equal(state().actor?.email, "ed@example.test");
  });

  it("starts signed out only for `?signedin=0`", () => {
    assert.equal(signedInFrom(""), true);
    assert.equal(signedInFrom("?signedin=1"), true);
    assert.equal(signedInFrom("?signedin=0"), false);
    assert.equal(signedInFrom("?load=0&signedin=0"), false);
    assert.equal(useAppStore.getInitialState().signedIn, true, "a test host has no address and starts signed in");
  });

  it("closes Settings when it signs out, and forgets the older pages", () => {
    state().openOverlay("settings");
    state().loadOlder();
    state().signOut();
    assert.equal(state().overlay, null);
    assert.equal(state().olderLoaded, 0);
  });
});
