import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionDetailsGroup } from "@/components/collections/CollectionDetailsGroup";
import { NewCollectionForm } from "@/components/collections/NewCollectionForm";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { LibrarySection } from "@/components/settings/LibrarySection";
import { PlaybackSection } from "@/components/settings/PlaybackSection";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { SettingsSchema } from "@/services/schemas/settings-schema";

const html = (element: ReactElement): string => renderToStaticMarkup(element);
const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = `${directory}/${entry.name}`;
  if (entry.isDirectory()) return sourceFiles(path);
  return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
});

describe("settings choice contracts", () => {
  it("defaults to Dark and motion Off, and refuses legacy values", () => {
    assert.equal(DEFAULT_SETTINGS.theme, "dark");
    assert.equal(DEFAULT_SETTINGS.reducedMotion, "off");
    const legacy = ["sys", "tem"].join("");
    assert.equal(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, theme: legacy }).success, false);
    assert.equal(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, reducedMotion: legacy }).success, false);
  });

  it("renders Theme and Reduce motion as two binary pairs", () => {
    const markup = html(createElement(AppearanceSection));
    assert.equal(count(markup, /aria-pressed=/g), 4);
    assert.match(markup, />Light<.*>Dark</s);
    assert.match(markup, />Off<.*>On</s);
  });

  it("renders the three-choice settings as selects and keeps Live on open binary", () => {
    const playback = html(createElement(PlaybackSection));
    const library = html(createElement(LibrarySection, {
      onOpenCollections: () => undefined, onOpenHistory: () => undefined,
    }));
    assert.match(playback, /<select[^>]*aria-label="Resume"/);
    assert.equal(count(playback, /aria-pressed=/g), 2);
    assert.match(library, /<select[^>]*aria-label="Default view"/);
    assert.equal(count(library, /aria-pressed=/g), 0);
  });
});

describe("collection choices", () => {
  it("uses selects for both collection Type controls", () => {
    const collection = {
      id: "c1", name: "Films", type: "movie" as const, total: 0, manual: 0, folders: 0, scan: "idle" as const,
    };
    for (const markup of [
      html(createElement(NewCollectionForm)), html(createElement(CollectionDetailsGroup, { collection })),
    ]) {
      assert.match(markup, /<select[^>]*aria-label="Collection type"/);
      assert.equal(count(markup, /<option/g), 3);
      assert.equal(count(markup, /aria-pressed=/g), 0);
    }
  });
});

describe("Segmented compliance inventory", () => {
  it("pins every frontend consumer to the two approved pages and finds no ChipGroup consumer", () => {
    const files = sourceFiles("src");
    const sources = files.map((file) => [file, readFileSync(file, "utf8")] as const);
    assert.deepEqual(
      sources.filter(([, source]) => source.includes("<Segmented")).map(([file]) => file),
      ["src/components/settings/AppearanceSection.tsx", "src/components/settings/PlaybackSection.tsx"],
    );
    assert.equal(sources.some(([, source]) => source.includes("ChipGroup")), false);
    const appearance = readFileSync("src/components/settings/AppearanceSection.tsx", "utf8");
    const playback = readFileSync("src/components/settings/PlaybackSection.tsx", "utf8");
    assert.equal(count(appearance, /<Segmented/g), 2, "Appearance is the two-pair page budget");
    assert.equal(count(playback, /<Segmented/g), 1, "Playback has one pair in one group");
  });
});
