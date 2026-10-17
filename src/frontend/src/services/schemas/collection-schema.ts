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
  itemCount: z.number().int().nonnegative(),
  folders: z.array(FolderSchema),
  scanning: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const CollectionListSchema = z.array(CollectionSchema);
