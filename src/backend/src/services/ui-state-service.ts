import type { z } from "zod";

import { DEFAULT_SETTINGS, DEFAULT_SHELL } from "../constants/ui-state.js";
import type { StoredAccountState } from "../store/ui-state-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import {
  type AccountState,
  type AdminSettings,
  type AdminShell,
  AdminSettingsSchema,
  AdminShellSchema,
  type UiStatePut,
} from "../types/ui-state.js";

/**
 * The admin's settings and shell layout, per signed-in account (docs/29 section 12.2, docs/26 D16). Each document is
 * written whole and the last write wins; an absent section is untouched. A state write is a preference, not an
 * administrative change, so it writes no audit entry.
 */
export function createUiStateService(deps: { store: Store; now: () => number; log: (line: string) => void }) {
  const { store, now, log } = deps;

  /** A stored document that does not read is answered as the defaults and logged; a missing one is the defaults. */
  function readDocument<T>(
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    raw: string | undefined,
    fallback: T,
    name: string,
  ): T {
    if (raw === undefined) return fallback;
    try {
      const value: unknown = JSON.parse(raw);
      const parsed = schema.safeParse(value);
      if (parsed.success) return parsed.data;
    } catch {
      // Unparseable JSON falls through to the same answer as a document of the wrong shape.
    }
    log(`admin_ui_state: the stored ${name} does not read; the defaults are answered`);
    return fallback;
  }

  function documentsOf(row: StoredAccountState | undefined): { settings: AdminSettings; shell: AdminShell } {
    return {
      settings: readDocument(AdminSettingsSchema, row?.settings, DEFAULT_SETTINGS, "settings"),
      shell: readDocument(AdminShellSchema, row?.shell, DEFAULT_SHELL, "shell"),
    };
  }

  return {
    read(principal: Principal): AccountState {
      const row = store.uiState.find(principal.accountId);
      return { ...documentsOf(row), ...(row && { updatedAt: row.updatedAt }) };
    },

    write(principal: Principal, body: UiStatePut): AccountState {
      return store.transaction(() => {
        const row = store.uiState.find(principal.accountId);
        const at = now();
        // An absent section keeps its stored text byte for byte, so a corrupt one is not rewritten as defaults.
        const settingsText = body.settings !== undefined
          ? JSON.stringify(body.settings)
          : (row?.settings ?? JSON.stringify(DEFAULT_SETTINGS));
        const shellText = body.shell !== undefined
          ? JSON.stringify(body.shell)
          : (row?.shell ?? JSON.stringify(DEFAULT_SHELL));
        store.uiState.upsert(principal.accountId, { settings: settingsText, shell: shellText }, at);
        const current = documentsOf(row);
        return { settings: body.settings ?? current.settings, shell: body.shell ?? current.shell, updatedAt: at };
      });
    },
  };
}

export type UiStateService = ReturnType<typeof createUiStateService>;
