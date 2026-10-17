import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { SHELL_WRITE_DELAY_MS, startShellWriteback } from "@/hooks/useShellWriteback";
import { startSettingsWriteback } from "@/hooks/useSettingsWriteback";
import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import type { ShellLayout } from "@/services/shell-state";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("shell write-back", () => {
  it("waits for hydration, debounces 400 ms and preserves an edit made during a write", async () => {
    const tasks = new Map<number, () => void>();
    const delays: number[] = [];
    const writes: ShellLayout[] = [];
    const first = deferred<ShellLayout>();
    let timerId = 0;
    const stop = startShellWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: (layout) => {
        writes.push(layout);
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
    assert.equal(tasks.size, 0, "defaults and pre-hydration edits are not written");
    useAppStore.setState({ shellWriteEnabled: true, savedShellRevision: state().shellRevision });
    state().setSurface("live");
    assert.deepEqual(delays, [SHELL_WRITE_DELAY_MS]);
    tasks.get(timerId)?.();
    assert.equal(writes.length, 1);

    state().setSurface("library");
    tasks.get(timerId)?.();
    assert.equal(writes.length, 1, "a second write waits for the first");
    first.resolve(writes[0]!);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes.length, 2);
    assert.equal(writes[1]?.surface, "library");
    stop();
  });
});

describe("settings write-back", () => {
  it("round-trips every setting including Rows, then rolls a refusal back without a loop", async () => {
    const writes: SettingsPatch[] = [];
    let refuse = false;
    const write = async (patch: SettingsPatch): Promise<SettingsAnswer> => {
      writes.push(patch);
      if (refuse) throw new Error("The setting was refused.");
      return { ...DEFAULT_SETTINGS, ...patch };
    };
    const stop = startSettingsWriteback({ getState: useAppStore.getState, subscribe: useAppStore.subscribe, write });
    state().setTheme("light");
    await Promise.resolve();
    assert.equal(writes.length, 0, "defaults and pre-hydration edits are not written");
    useAppStore.setState({
      theme: DEFAULT_SETTINGS.theme,
      settingsWriteEnabled: true,
      committedSettings: DEFAULT_SETTINGS,
      savedSettingsRevision: state().settingsRevision,
    });

    state().setLibraryPrefs({ libraryView: "rows" });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes[0]?.libraryView, "rows");
    assert.equal(Object.keys(writes[0] ?? {}).length, 19);

    refuse = true;
    state().setTheme("light");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(state().theme, DEFAULT_SETTINGS.theme);
    const countAfterRefusal = writes.length;
    await Promise.resolve();
    assert.equal(writes.length, countAfterRefusal);
    assert.equal(state().notice?.sentence, "The setting was refused.");
    stop();
  });
});
