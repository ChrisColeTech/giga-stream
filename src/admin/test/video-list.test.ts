import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoList } from "@/components/records/VideoList";

const draw = (videos: string[]): string =>
  renderToStaticMarkup(createElement(VideoList, { videos, onChange: () => undefined }));
const count = (html: string, needle: string): number => html.split(needle).length - 1;

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

  it("is the standard table: # and path under their words, no tick column, nothing sortable, no open button", () => {
    const html = draw(["D:\\a.mp4", "D:\\b.mp4"]);
    assert.ok(html.indexOf(">#<") < html.indexOf(">path<"), "the number column first, then the path");
    assert.ok(!html.includes('type="checkbox"') && !html.includes("aria-sort=") && !html.includes("Sort by"));
    assert.ok(!html.includes("data-primary"), "a video path opens nothing (`52` decision 6)");
    const row = html.slice(html.indexOf('data-col="path"'), html.indexOf("</li>"));
    assert.ok(row.indexOf(">D:\\a.mp4<") < row.indexOf('aria-label="Move'), "the verbs live in the end cell, after the path");
  });

  it("draws the standard skeleton rows while the list is empty, never a sentence; the add row stays", () => {
    const html = draw([]);
    assert.equal(count(html, 'aria-hidden="true" class="pointer-events-none'), 6);
    assert.ok(!html.includes(">D:<") && !html.includes("No videos"));
  });

  it("windows above 100 entries and maps every row at or under 100 (`52` decision 4)", () => {
    const many = draw(Array.from({ length: 200 }, (_, index) => `D:\\v${index}.mp4`));
    const mounted = count(many, "data-index=");
    assert.ok(many.includes('aria-rowcount="200"'));
    assert.ok(mounted > 0 && mounted <= 30, String(mounted));
    const ten = draw(Array.from({ length: 10 }, (_, index) => `D:\\s${index}.mp4`));
    assert.equal(count(ten, "data-index="), 10);
    assert.ok(ten.includes(">D:\\s9.mp4<"));
  });
});
