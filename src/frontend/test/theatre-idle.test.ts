import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { THEATRE_IDLE_MS } from "@/constants/theatre-idle";
import { overlayColors } from "@/lib/overlay-colors";
import { createIdleController, type IdleController } from "@/lib/theatre-idle";
import { useAppStore } from "@/store/app-store";

/** A fake clock: `advance` runs the scheduled task when its time comes; nothing sleeps. */
function fakeClock() {
  let now = 0;
  let next = 0;
  const tasks = new Map<number, { at: number; task: () => void }>();
  return {
    schedule: (task: () => void, delay: number): number => {
      next += 1;
      tasks.set(next, { at: now + delay, task });
      return next;
    },
    cancel: (id: number): void => {
      tasks.delete(id);
    },
    advance: (ms: number): void => {
      now += ms;
      for (const [id, entry] of tasks) {
        if (entry.at > now) continue;
        tasks.delete(id);
        entry.task();
      }
    },
    pending: (): number => tasks.size,
  };
}

interface Built {
  controller: IdleController;
  clock: ReturnType<typeof fakeClock>;
  log: string[];
}

function build(canIdle?: () => boolean): Built {
  const clock = fakeClock();
  const log: string[] = [];
  const controller = createIdleController({
    idleMs: THEATRE_IDLE_MS,
    schedule: clock.schedule,
    cancel: clock.cancel,
    onIdle: () => log.push("idle"),
    onActive: () => log.push("active"),
    canIdle,
  });
  return { controller, clock, log };
}

describe("idle controller", () => {
  it("goes idle after exactly idleMs and not a tick before", () => {
    const { controller, clock, log } = build();
    controller.arm();
    clock.advance(THEATRE_IDLE_MS - 1);
    assert.deepEqual(log, []);
    clock.advance(1);
    assert.deepEqual(log, ["idle"]);
  });

  it("activity re-arms the single timer", () => {
    const { controller, clock, log } = build();
    controller.arm();
    clock.advance(THEATRE_IDLE_MS - 1);
    controller.activity();
    assert.equal(clock.pending(), 1, "one timer, never two");
    clock.advance(THEATRE_IDLE_MS - 1);
    assert.deepEqual(log, []);
    clock.advance(1);
    assert.deepEqual(log, ["idle"]);
  });

  it("ignores a move to the same point and wakes on a different one", () => {
    const { controller, clock, log } = build();
    controller.activity({ x: 10, y: 20 });
    clock.advance(THEATRE_IDLE_MS);
    assert.deepEqual(log, ["idle"]);
    controller.activity({ x: 10, y: 20 });
    assert.deepEqual(log, ["idle"], "a synthetic move under a still cursor does not wake");
    controller.activity({ x: 11, y: 20 });
    assert.deepEqual(log, ["idle", "active"]);
    assert.equal(clock.pending(), 1, "the wake restarts the countdown");
  });

  it("fires onActive only on an idle to active transition", () => {
    const { controller, log } = build();
    controller.activity();
    controller.activity();
    controller.activity({ x: 1, y: 1 });
    assert.deepEqual(log, []);
  });

  it("stop cancels the timer and reports active when idle", () => {
    const { controller, clock, log } = build();
    controller.arm();
    controller.stop();
    assert.equal(clock.pending(), 0);
    clock.advance(THEATRE_IDLE_MS * 2);
    assert.deepEqual(log, [], "a stopped controller never goes idle");
    controller.arm();
    clock.advance(THEATRE_IDLE_MS);
    controller.stop();
    assert.deepEqual(log, ["idle", "active"]);
  });

  it("stays awake and starts no timer while canIdle says no, until the next activity", () => {
    let allowed = false;
    const { controller, clock, log } = build(() => allowed);
    controller.arm();
    clock.advance(THEATRE_IDLE_MS);
    assert.deepEqual(log, []);
    assert.equal(clock.pending(), 0, "no polling");
    allowed = true;
    controller.activity();
    clock.advance(THEATRE_IDLE_MS);
    assert.deepEqual(log, ["idle"]);
  });
});

describe("chromeIdle in the store", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.setState({ surface: "player" });
  });

  it("starts false, is set by the setter, and leaving Theatre clears it in the same transition", () => {
    const state = () => useAppStore.getState();
    assert.equal(state().chromeIdle, false);
    state().toggleTheatre();
    assert.equal(state().theatre, true);
    assert.equal(state().chromeIdle, false);
    state().setChromeIdle(true);
    assert.equal(state().chromeIdle, true);
    let seen: boolean | null = null;
    const unsubscribe = useAppStore.subscribe((next) => {
      if (!next.theatre) seen = next.chromeIdle;
    });
    state().toggleTheatre();
    unsubscribe();
    assert.equal(state().theatre, false);
    assert.equal(state().chromeIdle, false);
    assert.equal(seen, false, "never observable as Theatre off while still idle");
  });
});

describe("overlayColors", () => {
  const tokens = { panel: "#1e1e1e", faint: "#888888" };

  it("wears the faint symbol at rest and the panel colour while idle", () => {
    assert.deepEqual(overlayColors(tokens, false), { color: "#1e1e1e", symbolColor: "#888888" });
    assert.deepEqual(overlayColors(tokens, true), { color: "#1e1e1e", symbolColor: "#1e1e1e" });
  });

  it("passes Theatre's short #000 through unchanged", () => {
    assert.deepEqual(overlayColors({ panel: "#000", faint: "#888888" }, true), { color: "#000", symbolColor: "#000" });
  });
});
