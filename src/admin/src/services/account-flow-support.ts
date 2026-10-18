import { ApiError } from "@giga/http/api-error";
import { REQUEST_FAILED } from "@/constants/account-copy";
import { FAILURE_CODES } from "@/constants/api-sentences";
import type { AppState } from "@/store/app-store";
import type { AccountsService } from "./accounts";

/* What the account flows share (`35` section 5.4): the injected store view and service, the typed results, and how a
 * failure becomes one warn notice plus, when the backend named a field, a refusal under that row. */

/** The part of the store the flows read and write. `useAppStore.getState` satisfies it; a test passes the same. */
export type AccountStore = Pick<
  AppState,
  | "serial"
  | "signedIn"
  | "actor"
  | "accounts"
  | "workspaces"
  | "accountsStartLoad"
  | "accountsLoaded"
  | "accountsLoadFailed"
  | "accountUpsert"
  | "accountRemove"
  | "accountsMarkUnreachable"
  | "closeWorkspace"
  | "updateActor"
  | "endSession"
  | "say"
>;

export interface AccountFlowDeps {
  readonly service: Pick<AccountsService, "list" | "create" | "update" | "remove">;
  readonly store: () => AccountStore;
  /** Reads the audit tail again (`limit` entries); never rejects. */
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

/** The rows a refusal can sit under. `enabled` is the Enabled switch (the backend calls the field `disabled`). */
export type AccountField = "name" | "username" | "password" | "enabled";

export interface FlowOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FlowRefused {
  readonly ok: false;
  readonly sentence: string;
  readonly field?: AccountField;
  /** The answer belonged to an earlier session and was thrown away: nothing was written, nothing is said. */
  readonly dropped?: true;
}

export type FlowResult<T = undefined> = FlowOk<T> | FlowRefused;

export const DROPPED: FlowRefused = { ok: false, sentence: "", dropped: true };

export const done = <T>(value: T): FlowOk<T> => ({ ok: true, value });

/** True while the session that started a flow is still the session. */
export const stillSession = (store: () => AccountStore, serial: number): boolean =>
  store().signedIn && store().serial === serial;

const FIELDS: Readonly<Record<string, AccountField>> = {
  name: "name",
  username: "username",
  password: "password",
  disabled: "enabled",
};

/** A failure, said once on the notice line (`warn`) and, when the backend named one of the form's fields, returned with
 *  that field. A transport failure also marks the backend unreachable, which disables every write until a read works. */
export function refusal(store: AccountStore, error: unknown, fallbackField?: AccountField): FlowRefused {
  const api = error instanceof ApiError ? error : null;
  const sentence = api?.message ?? REQUEST_FAILED;
  const unreachable = api?.code === FAILURE_CODES.unreachable;
  if (unreachable) store.accountsMarkUnreachable(true);
  store.say(sentence, "warn", unreachable ? "Connection" : "Account");
  const field = (api?.field === undefined ? undefined : FIELDS[api.field]) ?? fallbackField;
  return { ok: false, sentence, ...(field !== undefined && { field }) };
}

export const codeOf = (error: unknown): string | null => (error instanceof ApiError ? error.code : null);
