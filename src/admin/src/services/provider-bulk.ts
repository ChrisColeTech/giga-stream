import type { BulkItem } from "@/lib/bulk-plan";
import type { ProviderBulkVerb } from "@/lib/provider-bulk";
import { isUnreachable, sentenceOf } from "./provider-flow-support";
import type { ProviderStore } from "./provider-flows";
import type { ProvidersService } from "./providers";

/** The one single-record call a bulk verb makes for each row (`hooks/useProviderBulk.ts`): `PUT { enabled }` for
 *  Enable and Disable, `DELETE` for Delete, straight to the service (no per-row notice or audit read: the shared runner
 *  says one summary and re-reads once). A success updates the list; a failure answers its sentence. */
export function createProviderBulkCall(deps: {
  readonly service: Pick<ProvidersService, "update" | "remove">;
  readonly store: () => Pick<ProviderStore, "providerUpsert" | "providerRemove" | "providersMarkUnreachable">;
}): (verb: ProviderBulkVerb) => (item: BulkItem<number>) => Promise<string | null> {
  const { service, store } = deps;
  return (verb) => async (item) => {
    try {
      if (verb === "delete") {
        await service.remove(item.id);
        store().providerRemove(item.id);
      } else {
        store().providerUpsert(await service.update(item.id, { enabled: verb === "enable" }));
      }
      return null;
    } catch (error: unknown) {
      if (isUnreachable(error)) store().providersMarkUnreachable(true);
      return sentenceOf(error);
    }
  };
}
