import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repaintElement } from "@/lib/video-repaint";
import { createRepaintController } from "@/lib/video-repaint-controller";

/** A fake element that logs every `display` write and every height read, in order. */
function fakeElement(display: string, throwsOnRead = false) {
  const log: string[] = [];
  let current = display;
  return {
    log,
    element: {
      style: {
        get display(): string {
          return current;
        },
        set display(value: string) {
          current = value;
          log.push(`display=${value}`);
        },
      },
      get offsetHeight(): number {
        log.push("read");
        if (throwsOnRead) throw new Error("detached");
        return 0;
      },
    },
  };
}

describe("repaintElement", () => {
  it("hides, reads, restores and reads again", () => {
    const { element, log } = fakeElement("");
    repaintElement(element);
    assert.deepEqual(log, ["display=none", "read", "display=", "read"]);
    assert.equal(element.style.display, "");
  });

  it("restores an explicit inline display exactly", () => {
    const { element, log } = fakeElement("flex");
    repaintElement(element);
    assert.equal(element.style.display, "flex");
    assert.deepEqual(log, ["display=none", "read", "display=flex", "read"]);
  });

  it("survives an element that throws on read and still restores display", () => {
    const { element } = fakeElement("flex", true);
    assert.doesNotThrow(() => repaintElement(element));
    assert.equal(element.style.display, "flex");
  });
});

/** A fake frame scheduler: `frame` runs everything scheduled so far, once. */
function fakeFrames() {
  let next = 0;
  const tasks = new Map<number, () => void>();
  return {
    schedule: (task: () => void): number => {
      next += 1;
      tasks.set(next, task);
      return next;
    },
    cancel: (id: number): void => {
      tasks.delete(id);
    },
    frame: (): void => {
      const due = [...tasks.values()];
      tasks.clear();
      due.forEach((task) => task());
    },
    pending: (): number => tasks.size,
  };
}

function setup() {
  const frames = fakeFrames();
  let repaints = 0;
  const controller = createRepaintController({
    schedule: frames.schedule,
    cancel: frames.cancel,
    repaint: () => {
      repaints += 1;
    },
    tolerance: 1,
  });
  return { frames, controller, repaints: () => repaints };
}

describe("createRepaintController", () => {
  it("repaints once, a frame after the surface becomes active", () => {
    const { frames, controller, repaints } = setup();
    controller.setActive(true);
    assert.equal(repaints(), 0);
    frames.frame();
    assert.equal(repaints(), 1);
  });

  it("coalesces any number of width changes in one frame into one repaint", () => {
    const { frames, controller, repaints } = setup();
    controller.setActive(true);
    frames.frame();
    controller.widthChanged(500);
    controller.widthChanged(900);
    controller.widthChanged(1302);
    frames.frame();
    assert.equal(repaints(), 2);
  });

  it("ignores changes of one pixel or less", () => {
    const { frames, controller, repaints } = setup();
    controller.setActive(true);
    controller.widthChanged(1000);
    frames.frame();
    controller.widthChanged(1001);
    controller.widthChanged(999.5);
    assert.equal(frames.pending(), 0);
    controller.widthChanged(1002.5);
    frames.frame();
    assert.equal(repaints(), 2);
  });

  it("does nothing while inactive and drops a pending repaint on hiding", () => {
    const { frames, controller, repaints } = setup();
    controller.widthChanged(1302);
    assert.equal(frames.pending(), 0);
    controller.setActive(true);
    controller.setActive(false);
    assert.equal(frames.pending(), 0);
    controller.widthChanged(900);
    frames.frame();
    assert.equal(repaints(), 0);
  });

  it("counts the first width after showing again, whatever the last one was", () => {
    const { frames, controller, repaints } = setup();
    controller.setActive(true);
    controller.widthChanged(1302);
    frames.frame();
    controller.setActive(false);
    controller.setActive(true);
    frames.frame();
    controller.widthChanged(1302);
    frames.frame();
    assert.equal(repaints(), 3);
  });

  it("dispose cancels the pending repaint", () => {
    const { frames, controller, repaints } = setup();
    controller.setActive(true);
    controller.dispose();
    frames.frame();
    assert.equal(repaints(), 0);
  });
});
