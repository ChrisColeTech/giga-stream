import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { NewProviderForm } from "@/components/providers/NewProviderForm";
import { ProvidersPage } from "@/pages/ProvidersPage";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const provider = (id: number, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id,
  name: `Prov${id}`,
  source: `src${id}`,
  is_active: true,
  order: id,
  family: "embed",
  movieTemplate: "https://p.example.test/movie/{tmdbId}",
  frameOrigins: ["https://cdn.example.test"],
  messageShape: "vidsrc-status",
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});
const page = (): string => renderLive(createElement(ProvidersPage, { active: true }));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};
const loaded = (items: AdminProvider[]): void => {
  state().providersReset(state().serial);
  state().providersLoaded(items);
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New provider form", () => {
  it("has Name, Family, Source and Movie template in that order, with no placeholder", () => {
    const html = page();
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Family"'));
    assert.ok(at(html, 'aria-label="Family"') < at(html, 'aria-label="Source"'));
    assert.ok(at(html, 'aria-label="Source"') < at(html, 'aria-label="Movie template"'));
    assert.ok(!html.includes('placeholder="'));
    assert.ok(html.includes("New provider") && html.includes('aria-label="Create. Name is required."'));
  });

  it("draws Family as field-size pills, Embed lit", () => {
    const html = renderLive(createElement(NewProviderForm));
    assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>Embed</);
    assert.match(html, /<button[^>]*aria-pressed="false"[^>]*>Stream</);
  });
});

describe("the providers list", () => {
  it("draws shimmer rows while nothing is read, with no sentence over them", () => {
    const html = page();
    assert.ok(html.includes("animate-skel-shimmer") && html.includes("Select all providers"));
    assert.ok(!html.includes("Prov1") && !html.includes("No providers"));
  });

  it("shows the headings, ticks, state words, a dimmed disabled row and Delete", () => {
    loaded([provider(2, { is_active: false }), provider(1)]);
    const html = page();
    for (const heading of [">order<", ">name<", ">source<", ">family<", ">state<"]) assert.ok(html.includes(heading), heading);
    assert.ok(at(html, ">Prov1<") < at(html, ">Prov2<"), "sorted by order");
    assert.ok(html.includes('aria-label="Select Prov1"') && html.includes('data-st="disabled"') && html.includes("opacity-45"));
    assert.ok(html.includes('title="Deletes the provider; titles stop getting sources from it."'));
  });

  it("keeps the rows of an earlier session hidden behind the skeleton", () => {
    loaded([provider(1)]);
    useAppStore.setState({ serial: 99 });
    assert.ok(!page().includes(">Prov1<"));
  });
});

describe("the toolbar", () => {
  it("draws Enable, Disable and Delete disabled with Tick a row first, beside an enabled Titles →", () => {
    const html = page();
    for (const verb of ["Enable", "Disable"]) assert.ok(html.includes(`aria-label="${verb}. Tick a row first"`), verb);
    assert.match(html, /<button[^>]*disabled=""[^>]*title="Tick a row first"[^>]*>Delete</);
    const forward = html.match(/<button[^>]*>Titles →/)?.[0] ?? "";
    assert.ok(forward.length > 0 && !forward.includes('disabled=""'));
  });

  it("names every ticked provider already enabled", () => {
    loaded([provider(1)]);
    state().providerTick(1, true);
    assert.ok(page().includes('aria-label="Enable. Every ticked provider is already enabled."'));
  });
});
