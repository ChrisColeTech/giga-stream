import { z } from "zod";

/** The frames of the backend's socket (docs/03 section 7.8). There is no replay and no sequence. */
export type BackendFrame =
  | { type: "hello"; data: { version: string; revision: number } }
  | { type: "channels.changed"; data: { revision: number } }
  | { type: "providers.changed"; data: { revision: number } }
  | { type: "titles.synced"; data: { titles: number; stale: number; ms: number; triggered: "admin" | "system" } }
  | { type: "pong"; data: { at: number } };

/** Where services report a change; the hub fans it out. */
export interface EventSink {
  publish(frame: BackendFrame): void;
}

/** The one frame a client may send. */
export const ClientFrameSchema = z.object({ type: z.literal("ping") }).strict();
