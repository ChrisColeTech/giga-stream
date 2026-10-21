import type { StoredUserSettings } from "../store/user-settings-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import { type UserSettings, type UserSettingsAnswer, UserSettingsSchema } from "../types/user-settings.js";

/**
 * The signed-in account's settings document (docs/62 sections 3.1 and 3.3): whole-document replace, the last
 * write wins, no merge here (the app applies the account's win once at sign-in, docs/62 D8). A preference, not
 * an administrative change: no audit entry. A stored document that no longer reads is answered as empty.
 */
export function createUserSettingsService(deps: { store: Store; now: () => number }) {
  const { store, now } = deps;

  const readDocument = (raw: string | undefined): UserSettings => {
    if (raw === undefined) return {};
    try {
      const value: unknown = JSON.parse(raw);
      const parsed = UserSettingsSchema.safeParse(value);
      if (parsed.success) return parsed.data;
    } catch {
      // Unparseable JSON falls through to the same answer as a document of the wrong shape.
    }
    return {};
  };

  return {
    read: async (principal: Principal): Promise<UserSettingsAnswer> => {
      const row: StoredUserSettings | undefined = await store.userSettings.find(principal.accountId);
      return { settings: readDocument(row?.settings), ...(row && { updatedAt: row.updatedAt }) };
    },

    write: async (principal: Principal, settings: UserSettings): Promise<UserSettingsAnswer> => {
      const at = now();
      await store.userSettings.upsert(principal.accountId, JSON.stringify(settings), at);
      return { settings, updatedAt: at };
    },
  };
}

export type UserSettingsService = ReturnType<typeof createUserSettingsService>;
