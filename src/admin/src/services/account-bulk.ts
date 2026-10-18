import { ApiError } from "@giga/http/api-error";
import { REQUEST_FAILED } from "@/constants/account-copy";
import { FAILURE_CODES } from "@/constants/api-sentences";
import type { AccountBulkVerb } from "@/lib/account-bulk";
import type { BulkItem } from "@/lib/bulk-plan";
import type { AccountId } from "@/types/admin-account";
import type { AccountStore } from "./account-flow-support";
import type { AccountsService } from "./accounts";

/** The one single-record call a bulk verb makes for each row (`hooks/useAccountBulk.ts`): `PATCH { disabled }` for Enable
 *  and Disable, `DELETE` for Delete, straight to the service (no per-row notice, no audit read, no session ending: the
 *  plan already kept the signed-in account out). A success updates the list; a failure answers its sentence. */
export function createAccountBulkCall(deps: {
  readonly service: Pick<AccountsService, "update" | "remove">;
  readonly store: () => Pick<AccountStore, "accountUpsert" | "accountRemove" | "accountsMarkUnreachable">;
}): (verb: AccountBulkVerb) => (item: BulkItem<AccountId>) => Promise<string | null> {
  const { service, store } = deps;
  return (verb) => async (item) => {
    try {
      if (verb === "delete") {
        await service.remove(item.id);
        store().accountRemove(item.id);
      } else {
        store().accountUpsert(await service.update(item.id, { disabled: verb === "disable" }));
      }
      return null;
    } catch (error: unknown) {
      if (!(error instanceof ApiError)) return REQUEST_FAILED;
      if (error.code === FAILURE_CODES.unreachable) store().accountsMarkUnreachable(true);
      return error.message;
    }
  };
}
