import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDetailsHover, createHoverGroup, type HoverGroup } from "@/lib/details-hover-controller";

const OPEN = 70;
const GRACE = 120;

/** A scheduler on a clock the test advances; nothing sleeps. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const tasks = new Map<number, { at: number; task: () => void }>();
  return {
    schedule: (task: () => void, delay: number): number => {
      const id = next++;
      tasks.set(id, { at: now + delay, task });
      return id;
    },
    cancel: (id: number): void => {
      tasks.delete(id);
    },
    pending: (): number => tasks.size,
    advance: (ms: number): void => {
      const end = now + ms;
      for (;;) {
        const due = [...tasks.entries()].filter(([, entry]) => entry.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) break;
        tasks.delete(due[0]);
        now = due[1].at;
        due[1].task();
      }
      now = end;
    },
  };
}

function card(clock: ReturnType<typeof fakeClock>, group: HoverGroup = createHoverGroup()) {
  const log: string[] = [];
  const hover = createDetailsHover({
    schedule: clock.schedule,
    cancel: clock.cancel,
    openDelay: OPEN,
    closeGrace: GRACE,
    group,
    onOpen: () => log.push("open"),
    onClose: () => log.push("close"),
  });
  return { hover, log };
}

describe("the details popover's hover timing", () => {
  it("opens only after the pointer has rested for the open delay", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.pointerEnter();
    clock.advance(OPEN - 1);
    assert.deepEqual(log, []);
    clock.advance(1);
    assert.deepEqual(log, ["open"]);
  });

  it("opens nothing for a fly-over that leaves before the delay", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.pointerEnter();
    clock.advance(OPEN - 10);
    hover.pointerLeave();
    assert.equal(clock.pending(), 0);
    clock.advance(1000);
    assert.deepEqual(log, []);
  });

  it("closes after the grace period once the pointer has left", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.pointerEnter();
    clock.advance(OPEN);
    hover.pointerLeave();
    clock.advance(GRACE - 1);
    assert.deepEqual(log, ["open"]);
    clock.advance(1);
    assert.deepEqual(log, ["open", "close"]);
  });

  it("stays open when the pointer comes back inside the grace period (glyph to popover)", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.pointerEnter();
    clock.advance(OPEN);
    hover.pointerLeave();
    clock.advance(GRACE - 20);
    hover.pointerEnter();
    clock.advance(1000);
    assert.deepEqual(log, ["open"]);
    hover.pointerLeave();
    clock.advance(GRACE);
    assert.deepEqual(log, ["open", "close"]);
  });

  it("opens at once on keyboard focus and closes after the grace when focus leaves", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.focus();
    assert.deepEqual(log, ["open"]);
    hover.blur();
    clock.advance(GRACE);
    assert.deepEqual(log, ["open", "close"]);
  });

  it("stays open while the pointer is on it even if focus leaves, and the other way round", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.focus();
    hover.pointerEnter();
    hover.blur();
    clock.advance(1000);
    assert.deepEqual(log, ["open"]);
    hover.focus();
    hover.pointerLeave();
    clock.advance(1000);
    assert.deepEqual(log, ["open"]);
  });

  it("focus moving from the glyph onto the popover keeps it open", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.focus();
    hover.blur();
    clock.advance(GRACE - 1);
    hover.focus();
    clock.advance(1000);
    assert.deepEqual(log, ["open"]);
  });

  it("closes at once on close (Escape) and drops pending timers", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.pointerEnter();
    clock.advance(OPEN);
    hover.pointerLeave();
    hover.close();
    assert.deepEqual(log, ["open", "close"]);
    assert.equal(clock.pending(), 0);
    hover.close();
    assert.deepEqual(log, ["open", "close"]);
  });

  it("toggles on a press where hover is not possible, and a held popover ignores pointer leaves", () => {
    const clock = fakeClock();
    const { hover, log } = card(clock);
    hover.toggle();
    assert.deepEqual(log, ["open"]);
    hover.pointerEnter();
    hover.pointerLeave();
    clock.advance(1000);
    assert.deepEqual(log, ["open"]);
    hover.toggle();
    assert.deepEqual(log, ["open", "close"]);
  });

  it("opens one popover at a time across cards", () => {
    const clock = fakeClock();
    const group = createHoverGroup();
    const first = card(clock, group);
    const second = card(clock, group);
    first.hover.focus();
    second.hover.pointerEnter();
    clock.advance(OPEN);
    assert.deepEqual(first.log, ["open", "close"]);
    assert.deepEqual(second.log, ["open"]);
    /* The first, closed by the group, can open again and closes the second. */
    first.hover.focus();
    assert.deepEqual(second.log, ["open", "close"]);
  });

  it("dispose drops timers without announcing and frees the group", () => {
    const clock = fakeClock();
    const group = createHoverGroup();
    const first = card(clock, group);
    const second = card(clock, group);
    first.hover.focus();
    first.hover.dispose();
    second.hover.focus();
    assert.deepEqual(first.log, ["open"]);
    first.hover.pointerEnter();
    first.hover.dispose();
    assert.equal(clock.pending(), 0);
  });
});
