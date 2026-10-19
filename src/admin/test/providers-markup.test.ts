import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { NewProviderForm } from "@/components/providers/NewProviderForm";
import { PREVIEW_PROVIDER_TOOLTIP, UNREACHABLE_REASON } from "@/constants/provider-copy";
import { ProvidersPage } from "@/pages/ProvidersPage";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const count = (html: string, needle: string): number => html.split(needle).length - 1;
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
    for (const heading of [">order<", ">name<", ">host<", ">family<", ">state<"]) {
      assert.ok(html.includes(heading), heading);
    }
    assert.ok(at(html, ">Prov1<") < at(html, ">Prov2<"), "sorted by order");
    assert.ok(html.includes('aria-label="Select Prov1"') && html.includes('data-st="disabled"'));
    assert.ok(html.includes("opacity-45"));
    assert.ok(html.includes("--cols:1.25rem 3.5rem minmax(10rem,1.4fr)") && html.includes('data-col="family"'));
    assert.ok(html.includes('title="Sort by order"') && html.includes('aria-sort="none"'));
    assert.ok(html.includes('title="Deletes the provider; titles stop getting sources from it."'));
  });

  it("shows the template's host, not the source slug, and the slug only for a stream provider (`55` decision 3)", () => {
    loaded([
      provider(1, { movieTemplate: "https://vidsrc.sh/embed/movie/{tmdbId}", source: "vidsrc" }),
      provider(2, { family: "stream", movieTemplate: undefined, source: "streamer" }),
      provider(3, { family: "embed", movieTemplate: "not a url", source: "broken" }),
    ]);
    const html = page();
    assert.ok(html.includes(">vidsrc.sh<") && !html.includes(">vidsrc<"), "the embed template's host, mono");
    assert.ok(html.includes(">streamer<"), "the stream provider's slug: it has no template");
    assert.ok(html.includes(">broken<"), "an unparseable template falls back to the slug");
  });

  it("draws the preview eye beside Delete for an embed provider with a template, and none for the others (`55` decision 4)", () => {
    loaded([
      provider(1),
      provider(2, { family: "stream", movieTemplate: undefined }),
      provider(3, { family: "embed", movieTemplate: undefined }),
    ]);
    const html = page();
    assert.equal(count(html, `aria-label="${PREVIEW_PROVIDER_TOOLTIP}"`), 1);
    assert.equal(count(html, "lucide-eye"), 1);
    const first = html.slice(html.indexOf(">Prov1<"), html.indexOf(">Prov2<"));
    assert.ok(first.indexOf(`aria-label="${PREVIEW_PROVIDER_TOOLTIP}"`) < first.indexOf(">Delete</button>"));
  });

  it("disables the eye with its reason while the backend cannot be reached", () => {
    loaded([provider(1)]);
    state().providersMarkUnreachable(true);
    const html = page();
    assert.ok(html.includes(`${PREVIEW_PROVIDER_TOOLTIP}. ${UNREACHABLE_REASON}`));
    assert.ok(!html.includes(`title="${PREVIEW_PROVIDER_TOOLTIP}"`));
  });

  it("keeps the rows of an earlier session hidden behind the skeleton", () => {
    loaded([provider(1)]);
    useAppStore.setState({ serial: 99 });
    assert.ok(!page().includes(">Prov1<"));
  });
});

describe("the table strip", () => {
  it("leaves the enabled Titles → to the page toolbar; Refresh is first and the bulk verbs are drawn, waiting", () => {
    const html = page();
    const table = html.slice(html.indexOf('aria-label="Providers table"'));
    const top = html.slice(0, html.indexOf("overflow-y-auto"));
    const forward = top.match(/<button[^>]*title="Go to Titles"[^>]*>Titles →<\/button>/)?.[0] ?? "";
    assert.ok(forward.length > 0 && !forward.includes('disabled=""'));
    assert.ok(table.includes('title="Refresh providers"') && !table.includes("Titles →"));
    for (const verb of ["Enable", "Disable"]) assert.ok(table.includes(`aria-label="${verb}. Tick `), verb);
  });

  it("names every ticked provider already enabled, with a Delete that is the armed two-step and no Clear selection", () => {
    loaded([provider(1)]);
    state().providerTick(1, true);
    const html = page();
    assert.ok(html.includes('aria-label="Enable. Every ticked provider is already enabled."'));
    assert.ok(html.includes(">Delete</button>") && !html.includes("Clear selection"));
  });
});

describe("a provider's workspace", () => {
  it("opens from the held list: the rail, the page toolbar (Discard; Save, Preview →), Details, Templates, Player, no trailing save", () => {
    loaded([provider(1)]);
    state().openWorkspace("providers", "1");
    const html = page();
    assert.ok(html.includes('aria-label="Provider sections"'));
    assert.ok(at(html, ">Details<") < at(html, ">Templates<") && at(html, ">Templates<") < at(html, ">Player<"));
    assert.ok(html.includes('aria-label="Discard changes. Nothing has changed."'));
    assert.ok(html.includes('aria-label="Save. Nothing has changed."'));
    assert.ok(!html.includes("Save details"), "the trailing save is gone (`55` decision 1)");
    assert.ok(
      at(html, "Discard changes") < at(html, 'aria-label="Save. Nothing has changed.') &&
        at(html, 'aria-label="Save. Nothing has changed.') < at(html, ">Save<") &&
        at(html, ">Save<") < at(html, "Preview →"),
      "Discard left; Save, then the promote rightmost (`55` decision 2)",
    );
    const promote = html.match(/<button[^>]*title="Preview provider"[^>]*>Preview →<\/button>/)?.[0] ?? "";
    assert.ok(promote.length > 0 && !promote.includes('disabled=""'), "the promote is the PromoteButton's shape");
    assert.ok(at(html, "Preview →") < at(html, 'id="pv-details"'));
    assert.ok(!html.includes("Titles →"), "the tab hop is gone: the promote is the preview");
    assert.ok(at(html, 'aria-label="Name"') < at(html, 'aria-label="Family"'));
    assert.ok(at(html, 'aria-label="Source"') < at(html, 'aria-label="Movie template"'));
    assert.ok(at(html, 'aria-label="Enabled"') < at(html, 'aria-label="Order"'));
    assert.ok(html.includes('role="switch"') && html.includes('aria-checked="true"'));
  });

  it("draws no promote for a stream-family provider: there is no embed to preview (`55` decision 7)", () => {
    loaded([provider(1, { family: "stream", movieTemplate: undefined })]);
    state().openWorkspace("providers", "1");
    const html = page();
    assert.ok(!html.includes("Preview →") && !html.includes("Titles →"), "no promote at all for a stream provider");
    loaded([provider(1)]);
    const embed = page();
    assert.ok(embed.includes("Preview →"), "an embed provider with a template previews");
  });

  it("draws the frame origins as chips in a field-height box, and the message shape as a select", () => {
    loaded([provider(1)]);
    state().openWorkspace("providers", "1");
    const html = page();
    assert.ok(html.includes('aria-label="Remove https://cdn.example.test"') && html.includes("min-h-9!"));
    assert.ok(html.includes('aria-label="Message shape"') && html.includes(">vidsrc-status<"));
    assert.ok(html.includes(">None<"));
    assert.ok(html.includes('aria-label="Episode template"'));
  });

  it("drops the template rows for a stream provider", () => {
    loaded([provider(1, { family: "stream", movieTemplate: undefined })]);
    state().openWorkspace("providers", "1");
    const html = page();
    assert.ok(!html.includes('aria-label="Movie template"') && !html.includes('aria-label="Episode template"'));
    assert.ok(html.includes('aria-label="Start parameter"'));
  });
});