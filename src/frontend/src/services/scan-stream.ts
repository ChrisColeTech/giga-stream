import { z } from "zod";
import type { ScanProgress } from "@/types/collection";
import { apiStream } from "./api";
import { readNdjson } from "./ndjson";

const FileSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  sizeBytes: z.number().nonnegative(),
  modifiedMs: z.number().nonnegative(),
});
const ScanEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("found"), file: FileSchema }),
  z.object({ type: z.literal("probed"), file: FileSchema, facts: z.object({ playable: z.boolean() }).passthrough() }),
  z.object({
    type: z.literal("progress"),
    found: z.number().int().nonnegative(),
    probed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative().nullable(),
  }),
  z.object({
    type: z.literal("done"),
    files: z.array(z.object({ path: z.string() }).passthrough()),
    found: z.number().int().nonnegative(),
    probed: z.number().int().nonnegative(),
    unplayable: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("cancelled"),
    found: z.number().int().nonnegative(),
    probed: z.number().int().nonnegative(),
  }),
]);

export async function streamFolderScan(
  folderId: string,
  onProgress: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body = await apiStream(`/api/folders/${encodeURIComponent(folderId)}/scan`, { signal, area: "Scan" });
  let progress: ScanProgress = { found: 0, probed: 0, total: null, done: false };
  for await (const event of readNdjson(body, ScanEventSchema)) {
    if (event.type === "found") progress = { ...progress, found: progress.found + 1 };
    if (event.type === "probed") progress = { ...progress, probed: progress.probed + 1 };
    if (event.type === "progress") progress = { ...event, done: false };
    if (event.type === "done") progress = { found: event.found, probed: event.probed, total: event.found, done: true };
    if (event.type === "cancelled") progress = { found: event.found, probed: event.probed, total: null, done: false };
    onProgress(progress);
    if (event.type === "done") return;
  }
  throw new Error("The scan stream ended before it finished.");
}
