import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { startSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { SHELL_WRITE_DELAY_MS, startShellWriteback } from "@/hooks/useShellWriteback";
import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import type { ShellLayout } from "@/services/shell-state";
import { useAppStore } from "@/store/app-store";
import { settingsPatchOf } from "@/store/settings-state";

const state = () => useAppStore.getState();

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function logApiEvent(): void {
  state().logEvent({ tone: "info", area: "Connection", sentence: "PATCH fileserver 200 in 1 ms." });
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("shell write-back", () => {
  it("debounces, ignores API log mutations and preserves a newer in-flight edit", async () => {
    const tasks = new Map<number, () => void>();
    const delays: number[] = [];
    const writes: ShellLayout[] = [];
    const first = deferred<ShellLayout>();
    let timerId = 0;
    const runLatest = (): void => {
      const task = tasks.get(timerId);
      tasks.delete(timerId);
      task?.();
    };
    const stop = startShellWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: (layout) => {
        writes.push(layout);
        logApiEvent();
        return writes.length === 1 ? first.promise : Promise.resolve(layout);
      },
      schedule: (task, delay) => {
        delays.push(delay);
        tasks.set(++timerId, task);
        return timerId;
      },
      cancel: (id) => tasks.delete(id),
    });

    state().setSurface("player");
    assert.equal(tasks.size, 0, "pre-hydration changes are not written");
    useAppStore.setState({ shellWriteEnabled: true, savedShellRevision: state().shellRevision });
    state().setSurface("live");
    assert.deepEqual(delays, [SHELL_WRITE_DELAY_MS]);
    runLatest();
    assert.equal(writes.length, 1);
    assert.equal(tasks.size, 0, "the API event did not requeue the same revision");

    state().setSurface("library");
    runLatest();
    assert.equal(writes.length, 1, "the newer write waits for the first");
    first.resolve(writes[0]!);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes.length, 2);
    assert.equal(writes[1]?.surface, "library");
    stop();
  });

  it("a saved layout write says nothing: no notice and no events row (`50` section 2.1)", async () => {
    let timer: (() => void) | undefined;
    useAppStore.setState({ shellWriteEnabled: true });
    const stop = startShellWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (layout) => layout,
      schedule: (task) => { timer = task; return 1; },
      cancel: () => undefined,
    });
    useAppStore.getState().setSurface("player");
    timer?.();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(useAppStore.getState().notice, null);
    assert.deepEqual(useAppStore.getState().events, []);
    stop();
  });

  it("does not retry a failed revision after event and notice mutations", async () => {
    const timer: { task?: () => void } = {};
    let writes = 0;
    useAppStore.setState({ shellWriteEnabled: true });
    const stop = startShellWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async () => {
        writes += 1;
        logApiEvent();
        throw new Error("Layout refused.");
      },
      schedule: (next) => {
        timer.task = next;
        return 1;
      },
      cancel: () => {
        delete timer.task;
      },
    });
    state().setSurface("live");
    const run = timer.task;
    delete timer.task;
    assert.ok(run);
    run();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes, 1);
    assert.equal(timer.task, undefined);
    stop();
  });

  it("keeps both writers disabled when snapshot parts are absent", () => {
    let shellWrites = 0;
    let settingsWrites = 0;
    const stopShell = startShellWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (layout) => {
        shellWrites += 1;
        return layout;
      },
      schedule: () => 1,
      cancel: () => undefined,
    });
    const stopSettings = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (patch) => {
        settingsWrites += 1;
        return { ...DEFAULT_SETTINGS, ...patch };
      },
    });
    state().applySnapshot({ unreadable: ["shell", "settings"] });
    state().setSurface("player");
    state().setTheme("light");
    assert.equal(shellWrites, 0);
    assert.equal(settingsWrites, 0);
    stopShell();
    stopSettings();
  });
});

describe("settings write-back", () => {
  it("builds one-key, admin-only and multiple-key patches, including Rows", () => {
    assert.deepEqual(settingsPatchOf({ ...state(), theme: "light" }, DEFAULT_SETTINGS), { theme: "light" });
    assert.deepEqual(settingsPatchOf({ ...state(), adminUrl: "new-address" }, DEFAULT_SETTINGS), {
      adminUrl: "new-address",
    });
    assert.deepEqual(
      settingsPatchOf(
        { ...state(), theme: "light", library: { ...state().library, libraryView: "rows" } },
        DEFAULT_SETTINGS,
      ),
      { theme: "light", libraryView: "rows" },
    );
  });

  it("ignores API logs, sends only changed keys and preserves a newer edit", async () => {
    const writes: SettingsPatch[] = [];
    const first = deferred<SettingsAnswer>();
    let committed: SettingsAnswer = DEFAULT_SETTINGS;
    useAppStore.setState({ settingsWriteEnabled: true, committedSettings: DEFAULT_SETTINGS });
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: (patch) => {
        writes.push(patch);
        logApiEvent();
        if (writes.length === 1) return first.promise;
        committed = { ...committed, ...patch };
        return Promise.resolve(committed);
      },
    });
    state().setTheme("light");
    assert.deepEqual(writes, [{ theme: "light" }]);
    state().setMotion("on");
    assert.equal(writes.length, 1);
    committed = { ...DEFAULT_SETTINGS, theme: "dark" };
    first.resolve(committed);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(writes[1], { reducedMotion: "on" });
    assert.equal(state().theme, "dark");
    assert.equal(state().motion, "on");
    stop();
  });

  it("sends an Admin address alone and accepts its normalized answer", async () => {
    const writes: SettingsPatch[] = [];
    useAppStore.setState({ settingsWriteEnabled: true, committedSettings: DEFAULT_SETTINGS });
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (patch) => {
        writes.push(patch);
        return { ...DEFAULT_SETTINGS, ...patch, adminUrl: "normalized-address" };
      },
    });
    state().setAdminUrl("entered-address");
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(writes, [{ adminUrl: "entered-address" }]);
    assert.equal(state().adminUrl, "normalized-address");
    stop();
  });

  it("rolls back a refusal once without an automatic request loop", async () => {
    const writes: SettingsPatch[] = [];
    useAppStore.setState({ settingsWriteEnabled: true, committedSettings: DEFAULT_SETTINGS });
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (patch) => {
        writes.push(patch);
        logApiEvent();
        throw new Error("The setting was refused.");
      },
    });
    state().setLibraryPrefs({ libraryView: "rows" });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(writes, [{ libraryView: "rows" }]);
    assert.equal(state().library.libraryView, DEFAULT_SETTINGS.libraryView);
    assert.equal(state().notice?.sentence, "The setting was refused.");
    stop();
  });
});
