import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { installGuardEvents } from "@/services/guard-events";
import { useAppStore } from "@/store/app-store";

type GuardListener = (report: unknown) => void;

let deliver: GuardListener | undefined;
let uninstalls: Array<() => void> = [];

/** The named preload seam, faked: the installer subscribes, the test delivers reports through the captured listener. */
function fakeElectronWindow(): void {
  (globalThis as { window?: unknown }).window = {
    pocHost: {
      runtime: "electron",
      onGuard: (listener: GuardListener) => {
        deliver = listener;
      },
      setPlayerPolicy: () => undefined,
      clearPlayerPolicy: () => undefined,
    },
  };
}

const state = () => useAppStore.getState();
const last = () => state().events.at(-1);

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  deliver = undefined;
});

afterEach(() => {
  for (const uninstall of uninstalls.splice(0)) uninstall();
  Reflect.deleteProperty(globalThis, "window");
});

describe("guard receiver", () => {
  it("logs one refused popup row with the host only, never a path or token", () => {
    fakeElectronWindow();
    uninstalls.push(installGuardEvents());
    deliver?.({ kind: "popup", url: "https://popup.example/hoist?token=x", blocked: true });
    const row = last();
    assert.equal(row?.area, "Connection");
    assert.equal(row?.tone, "warn");
    assert.equal(row?.sentence, "A popup was refused (popup.example).");
    assert.equal(row?.identity, undefined);
  });

  it("maps each kind to its sentence, area, tone and identity", () => {
    fakeElectronWindow();
    uninstalls.push(installGuardEvents());
    deliver?.({ kind: "navigate", url: "https://nav.example/", blocked: true });
    assert.equal(last()?.tone, "warn");
    assert.equal(last()?.sentence, "A top-level navigation was refused (nav.example).");
    deliver?.({ kind: "frame navigate", url: "https://frame.example/embed", blocked: false });
    assert.equal(last()?.tone, "info");
    assert.equal(last()?.sentence, "A frame navigation was observed (frame.example).");
    deliver?.({ kind: "player hijack", url: "https://frame.example/" });
    assert.equal(last()?.tone, "warn");
    assert.equal(last()?.sentence, "A player hijack was refused (frame.example).");
    deliver?.({ kind: "permission", origin: "https://frame.example/", permission: "camera" });
    assert.equal(last()?.tone, "info");
    assert.equal(last()?.sentence, "The frame asked for camera (frame.example).");
    assert.equal(last()?.identity, "camera");
    deliver?.({ kind: "ad blocked", url: "https://ads.example/banner.gif" });
    assert.equal(last()?.area, "Provider");
    assert.equal(last()?.tone, "info");
    assert.equal(last()?.sentence, "An ad was blocked (ads.example).");
    assert.equal(last()?.identity, "ads.example");
  });

  it("reduces a playlist address with credentials to its bare host", () => {
    fakeElectronWindow();
    uninstalls.push(installGuardEvents());
    deliver?.({ kind: "popup", url: "https://cdn.example.com/path/to/file.m3u8?token=x", blocked: true });
    assert.equal(last()?.sentence, "A popup was refused (cdn.example.com).");
    assert.doesNotMatch(last()?.sentence ?? "", /path|token|m3u8|\?|\//);
  });

  it("drops the host clause when the address cannot be parsed", () => {
    fakeElectronWindow();
    uninstalls.push(installGuardEvents());
    deliver?.({ kind: "popup", url: "not an address", blocked: true });
    assert.equal(last()?.sentence, "A popup was refused.");
    deliver?.({ kind: "popup", blocked: true });
    assert.equal(last()?.sentence, "A popup was refused.");
  });

  it("does not double-subscribe while installed and can resubscribe after an uninstall", () => {
    fakeElectronWindow();
    const uninstall = installGuardEvents();
    uninstalls.push(installGuardEvents());
    deliver?.({ kind: "player hijack", url: "https://frame.example/" });
    assert.equal(state().events.length, 1, "one subscription, one row");
    uninstall();
    uninstalls.push(installGuardEvents());
    deliver?.({ kind: "player hijack", url: "https://other.example/" });
    assert.equal(state().events.length, 2, "a later install feeds once again");
  });

  it("in a browser the installer is a no-op that notes the absent guards exactly once", () => {
    const first = installGuardEvents();
    const second = installGuardEvents();
    assert.equal(state().events.length, 1);
    const row = last();
    assert.equal(row?.id, "guard-browser-note");
    assert.equal(row?.area, "Connection");
    assert.equal(row?.tone, "info");
    assert.equal(row?.sentence, "The desktop shell guards are absent in a browser.");
    first();
    second();
    assert.equal(state().events.length, 1);
  });
});
