import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampSize, inside, limitsOf, openBox, placeAt, resized, roomOf, sized } from "../src/lib/child-bounds";
import { WORK_BODY, WORK_WIDTH, workSpec } from "../src/lib/child-metrics";

const room = roomOf({ width: 1600, height: 1000 });
const spec = workSpec("settings", "Settings");

describe("a child window's sizes", () => {
  it("opens at its content's size when that is under 80% of the main window", () => {
    const limits = limitsOf(spec, room);
    assert.deepEqual(sized(WORK_WIDTH, WORK_BODY), { width: 978, height: 752 });
    assert.deepEqual(limits.open, { width: 978, height: 752 });
  });

  it("opens no larger than 80% of a small main window, and never below its least", () => {
    const small = roomOf({ width: 900, height: 700 });
    const limits = limitsOf(spec, small);
    assert.equal(limits.open.width, Math.floor(small.width * 0.8));
    assert.ok(limits.open.width >= limits.min.width && limits.open.height >= limits.min.height);
  });

  it("may be made as large as the main window and no smaller than its least", () => {
    const limits = limitsOf(spec, room);
    assert.deepEqual(limits.max, { width: room.width, height: room.height });
    assert.deepEqual(clampSize({ width: 50, height: 50 }, limits), limits.min);
    assert.deepEqual(clampSize({ width: 9999, height: 9999 }, limits), limits.max);
  });

  it("caps its least to a main window smaller than it", () => {
    const tiny = roomOf({ width: 500, height: 300 });
    const limits = limitsOf(spec, tiny);
    assert.ok(limits.min.width <= tiny.width && limits.min.height <= tiny.height);
  });
});

describe("a child window's place", () => {
  it("centres a work surface on the main window", () => {
    const box = openBox(spec, room, undefined);
    assert.equal(Math.round(box.x + box.width / 2), 800);
    assert.equal(Math.round(box.y + box.height / 2), Math.round(room.y + room.height / 2));
  });

  it("puts a tool beside the main window's corner", () => {
    const tool = workSpec("scopes", "Scopes", { place: "corner", modal: false, escape: "never", width: 400, body: 300 });
    const box = openBox(tool, room, undefined);
    assert.deepEqual({ x: box.x, y: box.y }, { x: 64, y: room.y + 96 });
  });

  it("never covers the titlebar and never leaves the main window", () => {
    const size = { width: 400, height: 300 };
    assert.deepEqual(inside(-200, -200, size, room), { x: 0, y: room.y });
    assert.deepEqual(inside(5000, 5000, size, room), { x: 1600 - 400, y: room.y + room.height - 300 });
    const at = placeAt(spec, limitsOf(spec, room).open, room);
    assert.ok(at.y >= room.y);
  });

  it("opens where it last was, put back inside a main window that has shrunk", () => {
    const kept = { x: 1200, y: 600, width: 700, height: 500 };
    const smaller = roomOf({ width: 1000, height: 800 });
    const box = openBox(spec, smaller, kept);
    assert.ok(box.x + box.width <= smaller.width && box.y + box.height <= smaller.y + smaller.height);
  });
});

describe("resizing by an edge", () => {
  const limits = limitsOf(spec, room);
  const box = { x: 300, y: 200, width: 800, height: 600 };

  it("grows to the south-east by the drag", () => {
    const next = resized(box, "se", 50, 40, limits, room);
    assert.deepEqual(next, { x: 300, y: 200, width: 850, height: 640 });
  });

  it("keeps the far edge where it was on a west or north drag", () => {
    const next = resized(box, "nw", -60, -30, limits, room);
    assert.equal(next.x + next.width, box.x + box.width);
    assert.equal(next.y + next.height, box.y + box.height);
    assert.equal(next.width, 860);
    assert.equal(next.height, 630);
  });

  it("stops at its least size however far it is dragged in", () => {
    const next = resized(box, "se", -5000, -5000, limits, room);
    assert.deepEqual({ w: next.width, h: next.height }, { w: limits.min.width, h: limits.min.height });
  });

  it("stops at the main window's edge however far it is dragged out", () => {
    const next = resized(box, "se", 5000, 5000, limits, room);
    assert.equal(next.x + next.width, room.width);
    assert.equal(next.y + next.height, room.y + room.height);
  });
});
