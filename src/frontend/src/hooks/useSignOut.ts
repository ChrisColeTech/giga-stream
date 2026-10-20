import { useCallback } from "react";
import { SIGNED_OUT_NOTICE } from "@/constants/gate-copy";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { authPort } from "@/services/auth-port";
import { browserStorage, clearOwnedLocalState, type LocalStorageLike } from "@/services/local-state";
import { onDesktopRuntime } from "@/services/persistence";
import { useAppStore } from "@/store/app-store";
import { fieldsOfSettings } from "@/store/settings-state";

type SignOutRequest = () => Promise<void>;

/** Starts transport while the refresh token is still held, then synchronously clears every local projection. */
export async function performSignOut(
  request: SignOutRequest = () => authPort.signOut(),
  storage: LocalStorageLike | null = browserStorage(),
): Promise<void> {
  let pending: Promise<void>;
  try {
    pending = request();
  } catch {
    pending = Promise.resolve();
  }
  const store = useAppStore.getState();
  store.signOut();
  const revision = store.settingsRevision + 1;
  useAppStore.setState({
    ...fieldsOfSettings(DEFAULT_SETTINGS),
    committedSettings: DEFAULT_SETTINGS,
    settingsRevision: revision,
    savedSettingsRevision: revision,
  });
  if (!onDesktopRuntime()) {
    useAppStore.setState({
      shellWriteEnabled: false,
      settingsWriteEnabled: false,
    });
    clearOwnedLocalState(storage);
  }
  useAppStore.getState().say(SIGNED_OUT_NOTICE);
  await pending.catch(() => undefined);
}

export function useSignOut(): () => Promise<void> {
  return useCallback(() => performSignOut(), []);
}
