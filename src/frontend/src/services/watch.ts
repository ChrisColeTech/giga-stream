import type { ItemRef } from "@/types/library";
import { api } from "./api";
import { ClearedWatchSchema, RemovedWatchSchema, WatchWriteAnswerSchema, WatchWriteSchema } from "./schemas/watch-schema";
import type { z } from "zod";

const part = (value: string): string => encodeURIComponent(value);

export type WatchWrite = z.input<typeof WatchWriteSchema>;

export function writeWatch(write: WatchWrite) {
  return api("/api/watch", WatchWriteAnswerSchema, { method: "PUT", body: write, area: "Playback" });
}

export function removeWatch(watchId: string) {
  return api(`/api/watch/${part(watchId)}`, RemovedWatchSchema, { method: "DELETE", area: "Catalog" });
}

export function clearWatch() {
  return api("/api/watch", ClearedWatchSchema, { method: "DELETE", area: "Catalog" });
}

export type { ItemRef };
