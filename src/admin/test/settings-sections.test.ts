import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { labelColumn } from "@giga/ui/lib/label-column";
import {
  APPEARANCE_DEFAULTS,
  SETTINGS_LABELS,
  SETTINGS_SECTIONS,
  ZOOM_AT_MAX,
  ZOOM_AT_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/constants/settings-sections";
import { useAppStore } from "@/store/app-store";
import { SettingsSchema } from "@/services/schemas/account-state-schema";

const source = (name: string): string =>
  readFileSync(new URL(`../src/components/settings/${name}.tsx`, import.meta.url), "utf8");

describe("Settings' rail", () => {
  it("has three sections, in order: Appearance, Session, About", () => {
    assert.deepEqual(SETTINGS_SECTIONS.map((section) => section.id), ["appearance", "session", "about"]);
    assert.deepEqual(
      SETTINGS_SECTIONS.map((section) => section.label),
      ["Appearance", "Session", "About"],
    );
    for (const section of SETTINGS_SECTIONS) assert.ok(section.icon !== undefined);
  });
});

describe("Settings' label column", () => {
  it("lists every row label the three pages render, so the column does not move between pages", () => {
    const rows = ["AppearanceSection", "SessionSection", "AboutSection"].flatMap((file) =>
      Array.from(source(file).matchAll(/<Row\s+label="([^"]+)"/g), (match) => match[1] ?? ""),
    );
    assert.ok(rows.length >= 9, `found ${rows.length} rows`);
    for (const label of rows) assert.ok(SETTINGS_LABELS.includes(label), `${label} is missing from SETTINGS_LABELS`);
  });

  it("holds nothing that is not a row, and no repeats, and no question labels", () => {
    const written = ["AppearanceSection", "SessionSection", "AboutSection"]
      .map(source)
      .join("\n");
    for (const label of SETTINGS_LABELS) assert.ok(written.includes(`label="${label}"`), `${label} is no row`);
    assert.equal(new Set(SETTINGS_LABELS).size, SETTINGS_LABELS.length);
    for (const gone of ["Security question", "Answer", "Current password"]) assert.ok(!SETTINGS_LABELS.includes(gone), gone);
  });

  it("sizes one column from the longest label", () => {
    assert.equal(labelColumn(SETTINGS_LABELS), `${Math.ceil(Math.max(...SETTINGS_LABELS.map((label) => label.length)) * 8) + 36}px`);
  });
});

describe("Appearance's defaults", () => {
  it("are dark, amber, motion off and a zoom of 1, and the store starts there", () => {
    assert.deepEqual(APPEARANCE_DEFAULTS, { theme: "dark", accent: "amber", motion: "off", uiZoom: 1 });
    const initial = useAppStore.getInitialState();
    assert.deepEqual(
      [initial.theme, initial.accent, initial.motion, initial.uiZoom],
      [APPEARANCE_DEFAULTS.theme, APPEARANCE_DEFAULTS.accent, APPEARANCE_DEFAULTS.motion, APPEARANCE_DEFAULTS.uiZoom],
    );
  });

  it("accepts only Light/Dark and Off/On at the admin boundary", () => {
    const base = { theme: "dark", themeAccent: "amber", reducedMotion: "off", uiZoom: 1 };
    assert.equal(SettingsSchema.safeParse(base).success, true);
    assert.equal(SettingsSchema.safeParse({ ...base, theme: "system" }).success, false);
    assert.equal(SettingsSchema.safeParse({ ...base, reducedMotion: "system" }).success, false);
  });

  it("say why the zoom stops at either end", () => {
    assert.equal(ZOOM_AT_MIN, `The smallest zoom is ${ZOOM_MIN}.`);
    assert.equal(ZOOM_AT_MAX, `The largest zoom is ${ZOOM_MAX}.`);
  });
});
