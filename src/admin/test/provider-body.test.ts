import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmptyBody, providerChanges, providerCreateBody } from "@/lib/provider-body";
import { draftOfProvider } from "@/lib/provider-draft";
import type { AdminProvider } from "@/services/schemas/provider-schema";

const SAVED: AdminProvider = {
  id: 1,
  name: "Cinezo",
  source: "cinezo",
  is_active: true,
  order: 1,
  family: "embed",
  movieTemplate: "https://c.example.test/movie/{tmdbId}",
  episodeTemplate: "https://c.example.test/tv/{tmdbId}/{season}/{episode}",
  startParam: "startAt",
  origin: "https://c.example.test",
  frameOrigins: ["https://cdn.example.test"],
  messageShape: "vidsrc-status",
  created_at: "2026-10-01T09:00:00.000Z",
};

describe("the create body", () => {
  it("trims and sends the Movie template only for an embed provider", () => {
    const draft = { name: " A ", family: "embed" as const, source: " a ", movieTemplate: " https://x.test/{tmdbId} " };
    assert.deepEqual(providerCreateBody(draft), { name: "A", source: "a", family: "embed", movieTemplate: "https://x.test/{tmdbId}" });
    assert.deepEqual(providerCreateBody({ ...draft, family: "stream" }), { name: "A", source: "a", family: "stream" });
  });
});

describe("the PUT body", () => {
  it("is empty when nothing changed", () => {
    assert.ok(isEmptyBody(providerChanges(SAVED, draftOfProvider(SAVED))));
  });

  it("sends only the changed fields", () => {
    const draft = { ...draftOfProvider(SAVED), name: "Cinezo 2", order: 4, enabled: false, family: "stream" as const };
    assert.deepEqual(providerChanges(SAVED, draft), { name: "Cinezo 2", family: "stream", enabled: false, order: 4 });
  });

  it("clears an emptied optional field with null: text, frame origins and the message shape", () => {
    const draft = { ...draftOfProvider(SAVED), startParam: "", frameOrigins: [], messageShape: "" as const };
    assert.deepEqual(providerChanges(SAVED, draft), { startParam: null, frameOrigins: null, messageShape: null });
  });

  it("sends a new value for a field that was absent, and a changed frame-origin list whole", () => {
    const draft = {
      ...draftOfProvider(SAVED),
      subtitlesParam: "sub",
      frameOrigins: ["https://cdn.example.test", "https://ads.example.test"],
    };
    assert.deepEqual(providerChanges(SAVED, draft), {
      subtitlesParam: "sub",
      frameOrigins: ["https://cdn.example.test", "https://ads.example.test"],
    });
  });
});
