import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { FileRow } from "@/components/records/FileRow";
import { CHOOSE_FILE_TITLE, FILE_TIP, IMPORT_FILE_ACCEPT } from "@/constants/playlist-copy";
import { renderLive } from "./support/store";

const row = (props: { value?: string; error?: string; chooseReason?: string } = {}): string =>
  renderLive(
    createElement(FileRow, {
      tip: FILE_TIP,
      value: props.value ?? "",
      accept: IMPORT_FILE_ACCEPT,
      chooseTitle: CHOOSE_FILE_TITLE,
      onChoose: () => undefined,
      ...(props.error !== undefined && { error: props.error }),
      ...(props.chooseReason !== undefined && { chooseReason: props.chooseReason }),
    }),
  );

describe("the File row (modelled on the Folder row)", () => {
  it("is labelled File, with a read-only mono field and a ghost Choose file button with the Upload glyph", () => {
    const html = row();
    assert.ok(html.includes('<span class="truncate">File</span>'));
    assert.ok(/<input[^>]*readOnly=""[^>]*aria-label="File"[^>]*/.test(html) && html.includes("font-mono"));
    assert.ok(/<button[^>]*title="Choose a playlist file"[^>]*>.*lucide-upload.*Choose file<\/button>/.test(html));
    assert.ok(!html.includes('placeholder="'), "no placeholder: the format rides the tip");
  });

  it("opens a hidden file input that takes .m3u, .m3u8 and audio/x-mpegurl", () => {
    const html = row();
    const input = html.match(/<input[^>]*type="file"[^>]*>/)?.[0] ?? "";
    assert.ok(input.includes('accept=".m3u,.m3u8,audio/x-mpegurl"') && input.includes("hidden"), input);
    assert.ok(input.includes('tabindex="-1"'));
  });

  it("shows the chosen file's name, and a refusal under the row", () => {
    const html = row({ value: "us.m3u", error: "Choose a playlist file." });
    assert.ok(html.includes('value="us.m3u"'));
    assert.ok(html.includes('role="alert"') && html.includes("Choose a playlist file.") && html.includes('aria-invalid="true"'));
  });

  it("keeps the button in place, disabled with its reason, when the dialog cannot open", () => {
    const html = row({ chooseReason: "Importing." });
    assert.ok(html.includes('aria-label="Choose file. Importing."') && html.includes('disabled=""'));
  });
});
