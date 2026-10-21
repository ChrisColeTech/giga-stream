import { z } from "zod";

export const FolderSchema = z.object({
  id: z.string().min(1),
  collectionId: z.string().min(1),
  name: z.string().min(1),
  fileCount: z.number().int().nonnegative(),
  scanning: z.boolean(),
  lastScannedAt: z.number().int().nonnegative().optional(),
});

export const CollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["movie", "tv", "local"]),
  itemCount: z.number().int().nonnegative(),
  folders: z.array(FolderSchema),
  scanning: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const CollectionListSchema = z.array(CollectionSchema);

/** The account backend's collection (`62` section 3.3): the fileserver's row without folders or scans, which the
 *  account store does not have. The list answers `{ items }` the way the account routes answer their lists. The
 *  services fold the two readings into the app's own `CollectionAnswer`. */
export const AccountCollectionSchema = CollectionSchema.omit({ folders: true, scanning: true });
export const AccountCollectionListSchema = z.object({ items: z.array(AccountCollectionSchema) });

export const FolderSelectionSchema = z.object({ token: z.string().min(1), name: z.string().min(1) });
export const MembershipSchema = z.object({
  collectionId: z.string().min(1),
  source: z.enum(["manual", "folder"]),
});
export const MembershipListSchema = z.object({ memberships: z.array(MembershipSchema) });
export const RemovedSchema = z.object({ removed: z.string().min(1) });
