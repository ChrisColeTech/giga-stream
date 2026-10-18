import type { BulkItem } from "@/lib/bulk-plan";
import type { AppState } from "@/store/app-store";
import { isUnreachable, sentenceOf } from "./provider-flow-support";
import type { TitlesService } from "./titles";

/** The part of the store an add touches. */
export type TitleAddStore = Pick<AppState, "titleMarkStored" | "storedMarkStale" | "titlesMarkUnreachable">;

/** The one call the Browse TMDB `Add` makes for each row (`docs/47` section 3.3): `POST /api/titles/from-tmdb { id }`.
 *  On `201` the row reads `stored` (it dims) and the Stored list is marked to be read again when it is next shown. A
 *  failure answers its sentence, from the error table: `409 title.taken` (already stored, or deleted), `404
 *  title.not_found`, `422 title.invalid`, `503 tmdb.unavailable`; the shared runner says the summary and the per-title
 *  warnings. */
export function createTitleAddCall(deps: {
  readonly service: Pick<TitlesService, "addFromTmdb">;
  readonly store: () => TitleAddStore;
}): (item: BulkItem<string>) => Promise<string | null> {
  const { service, store } = deps;
  return async (item) => {
    try {
      await service.addFromTmdb(item.id);
      store().titleMarkStored(item.id);
      store().storedMarkStale();
      return null;
    } catch (error: unknown) {
      if (isUnreachable(error)) store().titlesMarkUnreachable(true);
      return sentenceOf(error);
    }
  };
}
