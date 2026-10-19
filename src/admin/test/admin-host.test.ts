import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { chooseFolder, clearPlayerPolicy, hostAvailable, setOverlay, setPlayerPolicy } from "@/services/admin-host";

const OVERLAY = { color: "#111", symbolColor: "#999", height: 39 };
const POLICY = { origin: "https://vidsrc.sh", frameOrigins: ["https://vidsrc.sh", "https://cdn.v.test"] };

/** Puts a fake `window` in place for one test; `afterEach` takes it away. */
function install(host: unknown): void {
  Reflect.set(globalThis, "window", { adminHost: host });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("in a plain browser or a test, where there is no adminHost", () => {
  it("says it has no host, chooses no folder and paints no strip", async () => {
    assert.equal(hostAvailable(), false);
    assert.equal(await chooseFolder(), null);
    assert.equal(await setOverlay(OVERLAY), false);
  });

  it("is the same with a window that has no adminHost", async () => {
    install(undefined);
    assert.equal(hostAvailable(), false);
    assert.equal(await chooseFolder(), null);
  });

  it("sets and clears no player policy", () => {
    assert.equal(setPlayerPolicy(POLICY), false);
    clearPlayerPolicy();
  });
});

describe("in the backend's own window", () => {
  it("is available when the preload exposes chooseFolder", () => {
    install({ chooseFolder: async () => null, setOverlay: async () => true });
    assert.equal(hostAvailable(), true);
  });

  it("answers the chosen folder, and null when the dialog was cancelled", async () => {
    install({ chooseFolder: async () => "D:\\Videos\\News", setOverlay: async () => true });
    assert.equal(await chooseFolder(), "D:\\Videos\\News");
    install({ chooseFolder: async () => null, setOverlay: async () => true });
    assert.equal(await chooseFolder(), null);
  });

  it("hands the caption strip's colours and height to the preload and reports its answer", async () => {
    const seen: unknown[] = [];
    install({
      chooseFolder: async () => null,
      setOverlay: async (overlay: unknown) => {
        seen.push(overlay);
        return true;
      },
    });
    assert.equal(await setOverlay(OVERLAY), true);
    assert.deepEqual(seen, [OVERLAY]);
  });

  it("is not available when the preload lacks chooseFolder, and then paints nothing without setOverlay", async () => {
    install({});
    assert.equal(hostAvailable(), false);
    assert.equal(await setOverlay(OVERLAY), false);
  });
});

describe("in the backend's own window, the preview's player policy", () => {
  it("hands the policy's exact origins to the preload's setPlayerPolicy, and clears it the same way", async () => {
    const seen: unknown[] = [];
    const cleared: boolean[] = [];
    install({
      chooseFolder: async () => null,
      setOverlay: async () => true,
      setPlayerPolicy: async (policy: unknown) => {
        seen.push(policy);
      },
      clearPlayerPolicy: async () => {
        cleared.push(true);
      },
    });
    assert.equal(setPlayerPolicy(POLICY), true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, [{ origin: "https://vidsrc.sh", frameOrigins: ["https://vidsrc.sh", "https://cdn.v.test"] }]);
    clearPlayerPolicy();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(cleared, [true]);
  });

  it("says false and clears nothing when the preload lacks the policy calls", () => {
    install({ chooseFolder: async () => null, setOverlay: async () => true });
    assert.equal(setPlayerPolicy(POLICY), false);
    clearPlayerPolicy();
  });

  it("takes a bridge that answers synchronously without a promise, and swallows a rejecting one", async () => {
    const seen: unknown[] = [];
    install({
      chooseFolder: async () => null,
      setOverlay: async () => true,
      setPlayerPolicy: (policy: unknown) => {
        seen.push(policy);
        return true;
      },
      clearPlayerPolicy: () => true,
    });
    assert.equal(setPlayerPolicy(POLICY), true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, [POLICY]);
    clearPlayerPolicy();
    install({
      chooseFolder: async () => null,
      setOverlay: async () => true,
      setPlayerPolicy: async () => {
        throw new Error("the IPC channel is down");
      },
      clearPlayerPolicy: async () => {
        throw new Error("the IPC channel is down");
      },
    });
    assert.equal(setPlayerPolicy(POLICY), true);
    clearPlayerPolicy();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
});
