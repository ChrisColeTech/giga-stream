import type { z } from "zod";
import type { CollectionType } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { api } from "./api";
import {
  MembershipListSchema,
  CollectionListSchema,
  CollectionSchema,
  RemovedSchema,
} from "./schemas/collection-schema";

export type CollectionAnswer = z.infer<typeof CollectionSchema>;

const part = (value: string): string => encodeURIComponent(value);

export function listCollections(signal?: AbortSignal): Promise<z.infer<typeof CollectionListSchema>> {
  return api("/api/collections", CollectionListSchema, { signal, area: "Catalog" });
}

export function createCollection(name: string, type: CollectionType): Promise<CollectionAnswer> {
  return api("/api/collections", CollectionSchema, { method: "POST", body: { name, type }, area: "Catalog" });
}

export function updateCollection(
  collectionId: string,
  change: { readonly name: string; readonly type: CollectionType },
): Promise<CollectionAnswer> {
  return api(`/api/collections/${part(collectionId)}`, CollectionSchema, {
    method: "PATCH",
    body: change,
    area: "Catalog",
  });
}

export function removeCollection(collectionId: string): Promise<z.infer<typeof RemovedSchema>> {
  return api(`/api/collections/${part(collectionId)}`, RemovedSchema, { method: "DELETE", area: "Catalog" });
}

export function addMember(collectionId: string, ref: ItemRef): Promise<CollectionAnswer> {
  return api(`/api/collections/${part(collectionId)}/items`, CollectionSchema, {
    method: "PUT",
    body: ref,
    area: "Catalog",
  });
}

export function removeMember(collectionId: string, ref: ItemRef): Promise<CollectionAnswer> {
  return api(
    `/api/collections/${part(collectionId)}/items/${part(ref.kind)}/${part(ref.id)}`,
    CollectionSchema,
    { method: "DELETE", area: "Catalog" },
  );
}

export function readMemberships(ref: ItemRef, signal?: AbortSignal) {
  return api(`/api/items/${part(ref.kind)}/${part(ref.id)}/collections`, MembershipListSchema, {
    signal,
    area: "Catalog",
  }).then((answer) => answer.memberships);
}
