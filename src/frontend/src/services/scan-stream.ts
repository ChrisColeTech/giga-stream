import { z } from "zod";
import type { ScanProgress } from "@/types/collection";
import { apiStream } from "./api";
import { readNdjson } from "./ndjson";

const RelativePathSchema = z.string().min(1).refine(
  (path) => !path.startsWith("/") && !path.startsWith("\\") && !/^[A-Za-z]:[\\/]/.test(path),
  "Scan paths must be relative.",
);
const FileSchema = z.object({
  path: RelativePathSchema,
  sizeBytes: z.number().nonnegative(),
  modifiedMs: z.number().nonnegative(),
}).strict();
const FactsSchema = z.object({
  playable: z.boolean(),
  problem: z.string().optional(),
  container: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  frameRate: z.number().positive().optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  audioChannels: z.number().int().positive().optional(),
}).strict();
const ScannedFileSchema = FileSchema.extend({ facts: FactsSchema.optional() });
export const ScanEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("found"), file: FileSchema }).strict(),
  z.object({ type: z.literal("probed"), file: FileSchema, facts: FactsSchema }).strict(),
  z.object({
    type: z.literal("progress"),
    found: z.number().int().nonnegative(),
    probed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative().nullable(),
  }).strict(),
  z.object({
    type: z.literal("done"),
    files: z.array(ScannedFileSchema),
    found: z.number().int().nonnegative(),
    probed: z.number().int().nonnegative(),
    unplayable: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    type: z.literal("cancelled"),
    found: z.number().int().nonnegative(),
    probed: z.number().int().nonnegative(),
  }).strict(),
]);

export type ScanTerminal = "done" | "cancelled";

export async function streamFolderScan(
  folderId: string,
  onProgress: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<ScanTerminal> {
  const body = await apiStream(`/api/folders/${encodeURIComponent(folderId)}/scan`, { signal, area: "Scan" });
  let progress: ScanProgress = { found: 0, probed: 0, total: null, done: false };
  for await (const event of readNdjson(body, ScanEventSchema)) {
    if (event.type === "found") progress = { ...progress, found: progress.found + 1 };
    if (event.type === "probed") progress = { ...progress, probed: progress.probed + 1 };
    if (event.type === "progress") progress = { ...event, done: false };
    if (event.type === "done") progress = { found: event.found, probed: event.probed, total: event.found, done: true };
    if (event.type === "cancelled") {
      progress = { found: event.found, probed: event.probed, total: event.found, done: true };
    }
    onProgress(progress);
    if (event.type === "done" || event.type === "cancelled") return event.type;
  }
  throw new Error("The scan stream ended before it finished.");
}
