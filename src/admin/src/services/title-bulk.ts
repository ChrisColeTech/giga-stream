import type { BulkItem } from "@/lib/bulk-plan";
import type { TitleBulkVerb } from "@/lib/title-bulk";
import { isUnreachable, sentenceOf } from "./provider-flow-support";
import type { TitleStore } from "./title-list-flow";
import type { TitlesService } from "./titles";

/** The one single-record call a Titles bulk verb makes for each row (`hooks/useTitleBulk.ts`): `PATCH { enabled }`
 *  for Enable and Disable, `POST .../revert` for Revert to TMDB, `DELETE` for Delete (manual and synced titles alike).
 *  No per-row notice or audit read: the shared runner says one summary and re-reads once. A failure answers its
 *  sentence. */
export function createTitleBulkCall(deps: {
  readonly service: Pick<TitlesService, "update" | "remove" | "revert">;
  readonly store: () => Pick<TitleStore, "titleUpsert" | "titleRemove" | "titlesMarkUnreachable">;
}): (verb: TitleBulkVerb) => (item: BulkItem<string>) => Promise<string | null> {
  const { service, store } = deps;
  return (verb) => async (item) => {
    try {
      if (verb === "delete") {
        await service.remove(item.id);
        store().titleRemove(item.id);
      } else if (verb === "revert") {
        store().titleUpsert(await service.revert(item.id));
      } else {
        store().titleUpsert(await service.update(item.id, { enabled: verb === "enable" }));
      }
      return null;
    } catch (error: unknown) {
      if (isUnreachable(error)) store().titlesMarkUnreachable(true);
      return sentenceOf(error);
    }
  };
}
