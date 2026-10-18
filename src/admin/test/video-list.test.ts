import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoList } from "@/components/records/VideoList";

const draw = (videos: string[]) => renderToStaticMarkup(createElement(VideoList, { videos, onChange: () => undefined }));

describe("the video list", () => {
  it("numbers the videos in play order, each path in mono with its whole path as the title", () => {
    const html = draw(["D:\\a.mp4", "D:\\b.mp4"]);
    assert.ok(html.indexOf(">1</span>") < html.indexOf(">2</span>"));
    assert.ok(html.indexOf('title="D:\\a.mp4"') < html.indexOf('title="D:\\b.mp4"'));
    assert.ok(html.includes('aria-label="Videos"'));
  });

  it("disables the first row's up and the last row's down with their reasons, and keeps the others", () => {
    const html = draw(["D:\\a.mp4", "D:\\b.mp4"]);
    assert.ok(html.includes('aria-label="Move D:\\a.mp4 up. Already first"'));
    assert.ok(html.includes('aria-label="Move D:\\b.mp4 down. Already last"'));
    assert.ok(/<button[^>]*aria-label="Move D:\\a.mp4 down"/.test(html));
    assert.ok(/<button[^>]*aria-label="Remove D:\\b.mp4"/.test(html));
  });

  it("ends with the add row: a path field and Add, disabled until a path is typed; no Choose", () => {
    const html = draw([]);
    assert.ok(html.includes('aria-label="Video to add"') && html.includes('aria-label="Add. Type a path first."'));
    assert.ok(!html.includes("Choose") && !html.includes("placeholder="));
  });
});
