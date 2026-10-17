import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DEFAULT_TAB, TAB_ORDER } from "@/constants/tabs";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the workspace slice", () => {
  it("starts on the Channels index, with no workspace open on any tab", () => {
    assert.equal(state().tab, DEFAULT_TAB);
    for (const tab of TAB_ORDER) assert.equal(state().workspaces[tab], null);
  });

  it("opens and closes a workspace per tab", () => {
    state().openWorkspace("channels", "ch-1");
    assert.equal(state().workspaces.channels, "ch-1");
    state().openWorkspace("channels", "ch-2");
    assert.equal(state().workspaces.channels, "ch-2", "opening another replaces it");
    state().closeWorkspace("channels");
    assert.equal(state().workspaces.channels, null);
  });

  it("keeps the tabs independent: a workspace opened on one tab stays when another tab is shown", () => {
    state().openWorkspace("channels", "ch-1");
    state().openWorkspace("jobs", "job-9");
    state().setTab("jobs");
    state().setTab("titles");
    assert.equal(state().workspaces.channels, "ch-1");
    assert.equal(state().workspaces.jobs, "job-9");
    assert.equal(state().workspaces.titles, null);
    state().closeWorkspace("jobs");
    assert.equal(state().workspaces.channels, "ch-1", "closing one leaves the others");
  });

  it("setTab shows a tab without opening or closing anything", () => {
    state().openWorkspace("providers", "pr-1");
    state().setTab("providers");
    assert.equal(state().tab, "providers");
    assert.equal(state().workspaces.providers, "pr-1");
  });

  it("requestTab switches the tab and opens the named workspace", () => {
    state().requestTab("channels", "ch-7");
    assert.equal(state().tab, "channels");
    assert.equal(state().workspaces.channels, "ch-7");
    state().requestTab("titles", "t-3");
    assert.equal(state().tab, "titles");
    assert.equal(state().workspaces.titles, "t-3");
    assert.equal(state().workspaces.channels, "ch-7", "the tab it left keeps its workspace");
  });

  it("requestTab with no id shows that tab's index, closing a workspace left open there", () => {
    state().openWorkspace("jobs", "job-1");
    state().requestTab("jobs");
    assert.equal(state().tab, "jobs");
    assert.equal(state().workspaces.jobs, null);
  });

  it("is reset by signing out: the Channels index, no workspace, no window", () => {
    state().requestTab("accounts", "ac-1");
    state().openOverlay("settings");
    state().signOut();
    assert.equal(state().tab, DEFAULT_TAB);
    for (const tab of TAB_ORDER) assert.equal(state().workspaces[tab], null);
    assert.equal(state().overlay, null);
  });
});
