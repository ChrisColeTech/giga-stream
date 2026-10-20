import type { StoredFavorite } from "../store/user-favorites-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import type { ItemRef, RefKind } from "../types/user-collection.js";

/** `PUT`/`DELETE /favorites` and `GET /favorites` answers (docs/62 section 3.3): the ref, the state, and for
 *  the list, when the account put it there. */
export interface UserFavorite {
  ref: ItemRef;
  favorite: boolean;
}

export interface UserFavoriteEntry extends UserFavorite {
  createdAt: number;
}

/** The account's favorites (docs/62 section 3.1): an idempotent set, every query scoped to its account. A
 *  preference, not an administrative change: no audit entry. */
export function createUserFavoritesService(deps: { store: Store; now: () => number }) {
  const { store, now } = deps;

  return {
    /** `PUT`/`DELETE /favorites/:kind/:itemId`: idempotent both ways, like the fileserver's route (`03` 3.12). */
    set: async (principal: Principal, refKind: RefKind, refId: string, favorite: boolean): Promise<UserFavorite> => {
      if (favorite) await store.userFavorites.add(principal.accountId, refKind, refId, now());
      else await store.userFavorites.remove(principal.accountId, refKind, refId);
      return { ref: { kind: refKind, id: refId }, favorite };
    },

    list: async (principal: Principal): Promise<{ items: UserFavoriteEntry[] }> => {
      const rows: StoredFavorite[] = await store.userFavorites.list(principal.accountId);
      return {
        items: rows.map((row) => ({
          ref: { kind: row.refKind, id: row.refId },
          favorite: true,
          createdAt: row.createdAt,
        })),
      };
    },
  };
}

export type UserFavoritesService = ReturnType<typeof createUserFavoritesService>;
