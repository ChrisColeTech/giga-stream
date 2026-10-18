import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addReason, addVideo, downReason, moveVideo, removeVideo, upReason } from "@/lib/video-order";

const LIST = ["D:\\a.mp4", "D:\\b.mp4", "D:\\c.mp4"];

describe("a live channel's video order", () => {
  it("moves a video up and down, and leaves the list as it is at either end", () => {
    assert.deepEqual(moveVideo(LIST, 1, -1), ["D:\\b.mp4", "D:\\a.mp4", "D:\\c.mp4"]);
    assert.deepEqual(moveVideo(LIST, 1, 1), ["D:\\a.mp4", "D:\\c.mp4", "D:\\b.mp4"]);
    assert.deepEqual(moveVideo(LIST, 0, -1), LIST);
    assert.deepEqual(moveVideo(LIST, 2, 1), LIST);
    assert.deepEqual(moveVideo(LIST, 7, 1), LIST);
  });

  it("removes a video and keeps the rest in order", () => {
    assert.deepEqual(removeVideo(LIST, 0), ["D:\\b.mp4", "D:\\c.mp4"]);
  });

  it("adds a trimmed path at the end, refusing an empty or a repeated one", () => {
    assert.deepEqual(addVideo(LIST, "  D:\\d.mp4 "), [...LIST, "D:\\d.mp4"]);
    assert.deepEqual(addVideo(LIST, "D:\\a.mp4"), LIST);
    assert.equal(addReason(LIST, "  "), "Type a path first.");
    assert.equal(addReason(LIST, "D:\\b.mp4"), "That video is already in the list.");
    assert.equal(addReason(LIST, "D:\\e.mp4"), undefined);
  });

  it("disables the move past either end with `Already first` and `Already last`", () => {
    assert.deepEqual([upReason(0), upReason(1)], ["Already first", undefined]);
    assert.deepEqual([downReason(2, 3), downReason(1, 3)], ["Already last", undefined]);
  });

  it("does not change the list it is given", () => {
    const list = [...LIST];
    moveVideo(list, 0, 1);
    removeVideo(list, 0);
    addVideo(list, "D:\\z.mp4");
    assert.deepEqual(list, LIST);
  });
});
