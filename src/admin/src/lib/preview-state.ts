import {
  MISSING_WORD,
  NO_CHANNEL,
  PLAYER_ERROR_TEXT,
  READING_WORD,
  UNSUPPORTED_NOTICE,
} from "@/constants/preview-copy";
import type { AdminChannel } from "@/types/admin-channel";
import { previewAddress } from "./preview-address";

/* The Preview window's state (`36` section 8), pure: what is attached, whether the stage wears its skeleton, the one
 * status line and whether `Retry` is offered. A state change is seen only on a read (the open, or `Retry`). */

export type PlayerError = "manifest failed" | "unreachable" | "media error" | "unsupported";

export interface PlayerStatus {
  readonly phase: "idle" | "loading" | "playing";
  readonly error: PlayerError | null;
}

export const PLAYER_IDLE: PlayerStatus = { phase: "idle", error: null };

export interface PreviewTarget {
  /** What the player plays, or null: nothing is attached. */
  readonly address: string | null;
  /** The stage wears the shimmer (the read is running, or the channel is being built). */
  readonly skeleton: boolean;
}

/** A live channel attaches only while `live` or `restarting`; `preparing` and `starting` show the skeleton; `stopped` and
 *  `failed` attach nothing. A stream channel always attaches. Nothing attaches while the read runs or with no channel. */
export function previewTarget(channel: AdminChannel | undefined, reading: boolean): PreviewTarget {
  if (reading) return { address: null, skeleton: true };
  if (channel === undefined) return { address: null, skeleton: false };
  if (channel.kind === "stream") return { address: previewAddress(channel), skeleton: false };
  if (channel.state === "live" || channel.state === "restarting") return { address: previewAddress(channel), skeleton: false };
  return { address: null, skeleton: channel.state === "preparing" || channel.state === "starting" };
}

export interface PreviewLine {
  /** The window's state word (`live`, `failed`, `missing`, `manifest failed`): never a sentence. */
  readonly line: string;
  readonly retry: boolean;
  /** The one sentence that explains a failed state, said once on the notice line; absent when the word is enough. */
  readonly notice?: string;
}

const errorText = (error: PlayerError): string => PLAYER_ERROR_TEXT[error];

/** The window's state word under the stage: a live channel's state (and the player's error after it), a stream
 *  channel's player phase or error. `Retry` while `failed`, `stopped`, missing, or the player failed. A failed channel's
 *  problem and the refusals that need words are the `notice`, not part of the line. */
export function previewLine(channel: AdminChannel | undefined, reading: boolean, player: PlayerStatus): PreviewLine {
  if (reading) return { line: READING_WORD, retry: false };
  if (channel === undefined) return { line: MISSING_WORD, retry: true, notice: NO_CHANNEL };
  const failed = player.error === null ? null : errorText(player.error);
  const unsupported = player.error === "unsupported" ? { notice: UNSUPPORTED_NOTICE } : {};
  if (channel.kind === "stream") {
    return failed === null
      ? { line: player.phase === "playing" ? "playing" : "loading", retry: false }
      : { line: failed, retry: true, ...unsupported };
  }
  const parts: string[] = [channel.state];
  const attached = channel.state === "live" || channel.state === "restarting";
  if (attached && failed !== null) parts.push(failed);
  const problem = channel.state === "failed" && channel.problem !== undefined ? { notice: channel.problem } : unsupported;
  return {
    line: parts.join(" · "),
    retry: channel.state === "failed" || channel.state === "stopped" || (attached && failed !== null),
    ...problem,
  };
}
