import { z } from "zod";

import { ERRORS } from "../constants/errors.js";

/**
 * The app's collections and the item refs they and the favorites share (docs/62 sections 3.1 and 3.3): the
 * fileserver's shapes (`src/fileserver/src/routes/collections.ts`), re-pointed at the account's rows. There
 * are no folders and no scans here, so a collection is its row and its manual members.
 */
export type RefKind = "title" | "local";

export const RefKindSchema = z.enum(["title", "local"]);

/** An item of the user's data, named the way the fileserver names one (`03` section 3.12). */
export interface ItemRef {
  kind: RefKind;
  id: string;
}

/** `PUT`/`DELETE /favorites/:kind/:itemId` and the item verbs' path: the kind and the item's id. */
export const RefParams = z.object({ kind: RefKindSchema, itemId: z.string().min(1).max(500) });

export interface UserCollection {
  id: string;
  name: string;
  type: "movie" | "tv" | "local";
  /** The manual members; this backend has no folders to count beside them. */
  itemCount: number;
  createdAt: number;
  updatedAt: number;
}

/** A trimmed name of 1 to 80 characters, the fileserver's rule (`03` section 3.7). */
const name = z.string().trim().min(1).max(80);

export const CollectionCreateSchema = z.object({ name, type: z.enum(["movie", "tv", "local"]) }).strict();
export type CollectionCreate = z.infer<typeof CollectionCreateSchema>;

export const CollectionPatchSchema = z
  .object({ name, type: z.enum(["movie", "tv", "local"]) })
  .partial()
  .strict();
export type CollectionPatch = z.infer<typeof CollectionPatchSchema>;

/** `PUT /collections/:collectionId/items`: the item to add. */
export const CollectionItemBody = z.object({ kind: RefKindSchema, id: z.string().min(1).max(500) }).strict();

export const CollectionParams = z.object({ collectionId: z.string().min(1).max(200) });

export const CollectionItemParams = z.object({
  collectionId: z.string().min(1).max(200),
  kind: RefKindSchema,
  itemId: z.string().min(1).max(500),
});

export const ItemOfKindParams = z.object({ kind: RefKindSchema, itemId: z.string().min(1).max(500) });

/** `GET /items/:kind/:itemId/collections`: where the item is, by hand (this backend has no folders). */
export interface CollectionMembership {
  collectionId: string;
  source: "manual";
}

/** The refusals the collections routes answer, named once. */
export const COLLECTION_REFUSALS = {
  invalid: ERRORS.collectionInvalid,
  notFound: ERRORS.collectionNotFound,
} as const;
