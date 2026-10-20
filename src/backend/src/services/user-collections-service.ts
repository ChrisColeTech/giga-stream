import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { StoredUserCollection } from "../store/user-collection-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import type {
  CollectionCreate,
  CollectionMembership,
  CollectionPatch,
  RefKind,
  UserCollection,
} from "../types/user-collection.js";

/** `404 collection.not_found`, for an unknown id as much as another account's. */
const notFound = (): AppError => new AppError(ERRORS.collectionNotFound);

/** The collection as the routes answer it (docs/62 section 3.3): the fileserver's DTO without folders or
 *  scans, which this backend does not have. */
function viewOf(row: StoredUserCollection, itemCount: number): UserCollection {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    itemCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The account's collections and their manual members (docs/62 sections 3.1 and 3.3): the fileserver's verbs,
 * every read and write filtered on the signed-in account. A preference, not an administrative change: no
 * audit entry.
 */
export function createUserCollectionsService(deps: { store: Store; now: () => number }) {
  const { store, now } = deps;

  /** The account's own collection, or 404; the id of another account is simply not there. */
  async function existing(principal: Principal, collectionId: string): Promise<StoredUserCollection> {
    const found = await store.userCollections.find(principal.accountId, collectionId);
    if (!found) throw notFound();
    return found;
  }

  async function view(principal: Principal, collectionId: string): Promise<UserCollection> {
    const row = await existing(principal, collectionId);
    return viewOf(row, await store.userCollections.itemCount(row.id));
  }

  return {
    list: async (principal: Principal): Promise<{ items: UserCollection[] }> => {
      const rows = await store.userCollections.list(principal.accountId);
      const items = await Promise.all(
        rows.map(async (row) => viewOf(row, await store.userCollections.itemCount(row.id))),
      );
      return { items };
    },

    create: async (principal: Principal, input: CollectionCreate): Promise<UserCollection> => {
      const at = now();
      const row: StoredUserCollection = {
        id: `col_${randomUUID()}`,
        accountId: principal.accountId,
        name: input.name,
        type: input.type,
        createdAt: at,
        updatedAt: at,
      };
      await store.userCollections.insert(row);
      return viewOf(row, 0);
    },

    update: async (principal: Principal, collectionId: string, patch: CollectionPatch): Promise<UserCollection> => {
      const row = await existing(principal, collectionId);
      await store.userCollections.update(
        principal.accountId,
        collectionId,
        patch.name ?? row.name,
        patch.type ?? row.type,
        now(),
      );
      return view(principal, collectionId);
    },

    remove: async (principal: Principal, collectionId: string): Promise<{ removed: string }> => {
      await existing(principal, collectionId);
      // The items go with it: the foreign key cascades (docs/62 section 3.1).
      await store.userCollections.remove(principal.accountId, collectionId);
      return { removed: collectionId };
    },

    addItem: async (
      principal: Principal,
      collectionId: string,
      refKind: RefKind,
      refId: string,
    ): Promise<UserCollection> => {
      await existing(principal, collectionId);
      await store.userCollections.addItem(collectionId, refKind, refId, now());
      return view(principal, collectionId);
    },

    removeItem: async (
      principal: Principal,
      collectionId: string,
      refKind: RefKind,
      refId: string,
    ): Promise<UserCollection> => {
      await existing(principal, collectionId);
      await store.userCollections.removeItem(collectionId, refKind, refId);
      return view(principal, collectionId);
    },

    itemCollections: async (
      principal: Principal,
      refKind: RefKind,
      refId: string,
    ): Promise<{ memberships: CollectionMembership[] }> => {
      const ids = await store.userCollections.itemCollections(principal.accountId, refKind, refId);
      return { memberships: ids.map((collectionId) => ({ collectionId, source: "manual" as const })) };
    },
  };
}

export type UserCollectionsService = ReturnType<typeof createUserCollectionsService>;
