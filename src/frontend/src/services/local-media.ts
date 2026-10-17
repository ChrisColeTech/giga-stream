import { z } from "zod";
import { api } from "./api";

const LocalMediaInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  videoCodec: z.string().min(1).optional(),
  audioCodec: z.string().min(1).optional(),
  container: z.string().min(1).optional(),
  playable: z.boolean(),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).optional(),
  collectionIds: z.array(z.string()),
  folderName: z.string(),
});

export type LocalMediaInfo = z.infer<typeof LocalMediaInfoSchema>;

const part = (value: string): string => encodeURIComponent(value);

export function readLocalMediaInfo(id: string, signal?: AbortSignal): Promise<LocalMediaInfo> {
  return api(`/api/media/local/${part(id)}/info`, LocalMediaInfoSchema, { signal, area: "Media" });
}

export function localMediaAddress(id: string): string {
  return `/api/media/local/${part(id)}`;
}
