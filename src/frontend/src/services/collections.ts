import type { z } from "zod";
import type { CollectionAnswer, CollectionType } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { COLLECTIONS_SIGNED_OUT } from "@/lib/collections-copy";
import { sessionInputs } from "@/store/selectors";
import { api } from "./api";
import { routeFor } from "./persistence";
import {
  MembershipListSchema,
  CollectionListSchema,
  CollectionSchema,
  RemovedSchema,
  AccountCollectionListSchema,
  AccountCollectionSchema,
} from "./schemas/collection-schema";

const part = (value: string): string => encodeURIComponent(value);

/** The account's row as the app's own: the account store has no folders and no scans, so a collection read from it
 *  carries none - the windows show the truthful zeros, never an invented scan. */
const withFolders = (row: z.infer<typeof AccountCollectionSchema>): CollectionAnswer => ({
  ...row,
  folders: [],
  scanning: false,
});

/** The two sets of verbs (`62` section 3.6): the fileserver's shared routes, and the account's - the same verbs and
 *  shapes (`03` section 3.7), re-pointed at the signed-in account's rows. The signatures are the service's and do not
 *  change; only the addresses and the account rows' missing folders differ. */
const FILESERVER = {
  list: (signal?: AbortSignal): Promise<CollectionAnswer[]> =>
    api("/api/collections", CollectionListSchema, { signal, area: "Catalog" }),
  create: (name: string, type: CollectionType): Promise<CollectionAnswer> =>
    api("/api/collections", CollectionSchema, { method: "POST", body: { name, type }, area: "Catalog" }),
  update: (collectionId: string, change: { readonly name: string; readonly type: CollectionType }) =>
    api(`/api/collections/${part(collectionId)}`, CollectionSchema, {
      method: "PATCH",
      body: change,
      area: "Catalog",
    }),
  remove: (collectionId: string) =>
    api(`/api/collections/${part(collectionId)}`, RemovedSchema, { method: "DELETE", area: "Catalog" }),
  addMember: (collectionId: string, ref: ItemRef): Promise<CollectionAnswer> =>
    api(`/api/collections/${part(collectionId)}/items`, CollectionSchema, {
      method: "PUT",
      body: ref,
      area: "Catalog",
    }),
  removeMember: (collectionId: string, ref: ItemRef): Promise<CollectionAnswer> =>
    api(`/api/collections/${part(collectionId)}/items/${part(ref.kind)}/${part(ref.id)}`, CollectionSchema, {
      method: "DELETE",
      area: "Catalog",
    }),
  memberships: (ref: ItemRef, signal?: AbortSignal) =>
    api(`/api/items/${part(ref.kind)}/${part(ref.id)}/collections`, MembershipListSchema, { signal, area: "Catalog" }),
};

const ACCOUNT = {
  list: async (signal?: AbortSignal): Promise<CollectionAnswer[]> => {
    const answer = await api("/api/account/collections", AccountCollectionListSchema, { signal, area: "Catalog" });
    return answer.items.map(withFolders);
  },
  create: async (name: string, type: CollectionType): Promise<CollectionAnswer> =>
    withFolders(
      await api("/api/account/collections", AccountCollectionSchema, {
        method: "POST",
        body: { name, type },
        area: "Catalog",
      }),
    ),
  update: async (collectionId: string, change: { readonly name: string; readonly type: CollectionType }) =>
    withFolders(
      await api(`/api/account/collections/${part(collectionId)}`, AccountCollectionSchema, {
        method: "PATCH",
        body: change,
        area: "Catalog",
      }),
    ),
  remove: (collectionId: string) =>
    api(`/api/account/collections/${part(collectionId)}`, RemovedSchema, { method: "DELETE", area: "Catalog" }),
  addMember: async (collectionId: string, ref: ItemRef): Promise<CollectionAnswer> =>
    withFolders(
      await api(`/api/account/collections/${part(collectionId)}/items`, AccountCollectionSchema, {
        method: "PUT",
        body: ref,
        area: "Catalog",
      }),
    ),
  removeMember: async (collectionId: string, ref: ItemRef): Promise<CollectionAnswer> =>
    withFolders(
      await api(
        `/api/account/collections/${part(collectionId)}/items/${part(ref.kind)}/${part(ref.id)}`,
        AccountCollectionSchema,
        { method: "DELETE", area: "Catalog" },
      ),
    ),
  memberships: (ref: ItemRef, signal?: AbortSignal) =>
    api(`/api/account/items/${part(ref.kind)}/${part(ref.id)}/collections`, MembershipListSchema, {
      signal,
      area: "Catalog",
    }),
};

/** The resolver's choice at each call (`62` section 3.6): signed in the account's rows, signed out the desktop keeps
 *  the fileserver, and a signed-out browser has no home for collections. The verbs are async so the refusal reaches
 *  the call sites as a rejection they already speak, never as a synchronous throw inside an effect. */
async function verbs(): Promise<typeof FILESERVER> {
  const route = routeFor("collections", sessionInputs());
  if (route === "account") return ACCOUNT;
  if (route === "server") return FILESERVER;
  throw new Error(COLLECTIONS_SIGNED_OUT);
}

export async function listCollections(signal?: AbortSignal): Promise<CollectionAnswer[]> {
  return (await verbs()).list(signal);
}

export async function createCollection(name: string, type: CollectionType): Promise<CollectionAnswer> {
  return (await verbs()).create(name, type);
}

export async function updateCollection(
  collectionId: string,
  change: { readonly name: string; readonly type: CollectionType },
): Promise<CollectionAnswer> {
  return (await verbs()).update(collectionId, change);
}

export async function removeCollection(collectionId: string): Promise<z.infer<typeof RemovedSchema>> {
  return (await verbs()).remove(collectionId);
}

export async function addMember(collectionId: string, ref: ItemRef): Promise<CollectionAnswer> {
  return (await verbs()).addMember(collectionId, ref);
}

export async function removeMember(collectionId: string, ref: ItemRef): Promise<CollectionAnswer> {
  return (await verbs()).removeMember(collectionId, ref);
}

export async function readMemberships(ref: ItemRef, signal?: AbortSignal) {
  return (await verbs()).memberships(ref, signal).then((answer) => answer.memberships);
}
