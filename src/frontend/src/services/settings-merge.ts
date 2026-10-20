import { SETTINGS_CACHE_NOTICE } from "@/constants/gate-copy";
import { settingsOfFields } from "@/store/settings-state";
import { api } from "./api";
import { writeLocalSettings } from "./local-state";
import { onDesktopRuntime } from "./persistence";
import { AccountSettingsSchema } from "./schemas/settings-schema";
import { useAppStore } from "@/store/app-store";

/** The one-time merge of `62` D8: at sign-in, and at a session the boot's restore brought back, the account's
 *  settings document wins over whatever this device had - once - and the events drawer says plainly that local
 *  changes were replaced. Keys the account does not hold keep the device's values; after the merge every settings
 *  write goes to the account (the account backend mirrors it into the browser's offline cache), and a sign-out keeps
 *  the device's local state. A document that cannot be read (the backend unreachable) merges nothing: the device's
 *  settings stand and the next write still goes to the account. */
export async function mergeAccountSettings(): Promise<void> {
  const answer = await api("/api/account/settings", AccountSettingsSchema).catch(() => null);
  if (answer === null) return;
  const store = useAppStore.getState();
  const merged = { ...settingsOfFields(store), ...answer.settings };
  store.applyAccountSettings(merged, Object.keys(answer.settings).length > 0);
  /* The offline cache: in a browser the merged document mirrors into the local store, so an offline boot still has
   * the account's last settings. A refused write is a warning, never a failed sign-in. */
  if (!onDesktopRuntime() && !writeLocalSettings(merged)) store.say(SETTINGS_CACHE_NOTICE, "warn");
}
