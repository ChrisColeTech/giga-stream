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
  // The current fileserver predates the documented type column. Keep its answers readable until that migration lands.
  type: z.enum(["movie", "tv", "local"]).optional(),
  itemCount: z.number().int().nonnegative(),
  folders: z.array(FolderSchema),
  scanning: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const CollectionListSchema = z.array(CollectionSchema);

export const FolderSelectionSchema = z.object({ token: z.string().min(1), name: z.string().min(1) });
export const CollectionIdsSchema = z.object({ collectionIds: z.array(z.string().min(1)) });
export const RemovedSchema = z.object({ removed: z.string().min(1) });
