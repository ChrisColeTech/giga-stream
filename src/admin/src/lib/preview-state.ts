import { NO_CHANNEL, PLAYER_ERROR_TEXT, READING_WORD } from "@/constants/preview-copy";
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
  readonly line: string;
  readonly retry: boolean;
}

const errorText = (error: PlayerError): string => PLAYER_ERROR_TEXT[error];

/** The mono line under the stage: a live channel's state word (and a failed one's problem), then the player's error; a
 *  stream channel's player phase or error. `Retry` while `failed`, `stopped`, missing, or the player failed. */
export function previewLine(channel: AdminChannel | undefined, reading: boolean, player: PlayerStatus): PreviewLine {
  if (reading) return { line: READING_WORD, retry: false };
  if (channel === undefined) return { line: NO_CHANNEL, retry: true };
  const failed = player.error === null ? null : errorText(player.error);
  if (channel.kind === "stream") {
    return failed === null ? { line: player.phase === "playing" ? "playing" : "loading", retry: false } : { line: failed, retry: true };
  }
  const parts: string[] = [channel.state];
  if (channel.state === "failed" && channel.problem !== undefined) parts.push(channel.problem);
  const attached = channel.state === "live" || channel.state === "restarting";
  if (attached && failed !== null) parts.push(failed);
  return {
    line: parts.join(" · "),
    retry: channel.state === "failed" || channel.state === "stopped" || (attached && failed !== null),
  };
}
