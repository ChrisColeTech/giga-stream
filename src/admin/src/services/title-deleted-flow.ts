import { AUDIT_AFTER_WRITE } from "@/constants/audit-limits";
import { titleRestored } from "@/constants/title-copy";
import { deletedName } from "@/lib/title-restore";
import { DROPPED, codeOf, done, refusalOf } from "./provider-flow-support";
import { titlePorts, type TitleResult, type TitleStore } from "./title-list-flow";
import type { TitlesService } from "./titles";

export interface TitleDeletedFlow {
  /** Reads the deleted synced titles (first show, Refresh, after a delete). */
  loadDeleted: () => Promise<TitleResult>;
  /** Removes one title's record: it returns on the next browse or sync. */
  restore: (id: string) => Promise<TitleResult>;
}

/** The Deleted titles group's orchestration (`37` section 4.4). Like every flow it records the session's serial before
 *  it awaits and writes only if the session is unchanged after. A failed read keeps the rows it had and says why; a
 *  restore of a title that is no longer listed (`404 title.not_found`) reads the list again. */
export function createTitleDeletedFlow(deps: {
  readonly service: Pick<TitlesService, "listDeleted" | "restore">;
  readonly store: () => TitleStore;
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}): TitleDeletedFlow {
  const { service, store, audit } = deps;
  const ports = titlePorts(store);
  const alive = (serial: number): boolean => store().signedIn && store().serial === serial;

  async function loadDeleted(): Promise<TitleResult> {
    const serial = store().serial;
    store().titlesDeletedStart();
    try {
      const items = await service.listDeleted();
      if (!alive(serial)) return DROPPED;
      store().titlesDeletedLoaded(items);
      return done(undefined);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      store().titlesDeletedFailed();
      return refusalOf(ports, error);
    }
  }

  async function restore(id: string): Promise<TitleResult> {
    const serial = store().serial;
    const item = store().titles.deleted.items.find((one) => one.id === id);
    try {
      await service.restore(id);
      if (!alive(serial)) return DROPPED;
      store().titleDeletedRemove(id);
      store().say(titleRestored(item === undefined ? id : deletedName(item)));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      const result = refusalOf(ports, error);
      if (codeOf(error) === "title.not_found") void loadDeleted();
      return result;
    }
  }

  return { loadDeleted, restore };
}
