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

export const FolderSelectionSchema = z.object({ token: z.string().min(1), name: z.string().min(1) });
export const MembershipSchema = z.object({
  collectionId: z.string().min(1),
  source: z.enum(["manual", "folder"]),
});
export const MembershipListSchema = z.object({ memberships: z.array(MembershipSchema) });
export const RemovedSchema = z.object({ removed: z.string().min(1) });
