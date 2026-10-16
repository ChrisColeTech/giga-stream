import { AppError, ERRORS } from "../constants/errors.ts";
import { PLAYLIST_CACHE, SEGMENT_CACHE } from "../constants/media.ts";
import { logoPng } from "../stream/logo-png.ts";
import type { ChannelRuntime } from "./channel-runtime.ts";
import type { FaultState } from "./fault-state.ts";

const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  vtt: "text/vtt",
  m4s: "video/mp4",
  mp4: "video/mp4",
  aac: "audio/aac",
};

export interface MediaAnswer {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

const sleepFor = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The stream's bytes (docs/10 section 3.1): playlists and segments from a channel's running stream, with
 * its active fault applied, and the channel logos. Refusals are AppErrors the one handler answers.
 */
export function createStreamService(runtime: ChannelRuntime, faults: FaultState, knows: (id: string) => boolean,
  sleep = sleepFor) {
  return {
    async read(channelId: string, parts: string[]): Promise<MediaAnswer> {
      if (parts.length < 1 || parts.length > 2 || !parts.every((part) => SAFE_PART.test(part))) {
        throw new AppError(ERRORS.pathInvalid);
      }
      const backend = runtime.backend(channelId);
      if (!backend) throw new AppError(ERRORS.channelNotFound, { id: channelId });
      const file = parts.at(-1) ?? "";
      const extension = file.split(".").at(-1)?.toLowerCase() ?? "";
      const isPlaylist = extension === "m3u8";
      if (!isPlaylist) {
        const decision = faults.segment(channelId);
        if (decision.delayMs > 0) await sleep(decision.delayMs);
        if (decision.status !== 200) throw new AppError(ERRORS.mediaNotFound);
      }
      const bytes = await backend.read(parts);
      if (bytes === null) throw new AppError(ERRORS.mediaNotFound);
      let body = bytes;
      if (isPlaylist && !(parts.length === 1 && file === "master.m3u8")) {
        const outcome = faults.playlist(channelId, parts.join("/"), bytes.toString("utf-8"));
        if (outcome.status !== 200) throw new AppError(ERRORS.playlistUnavailable);
        body = Buffer.from(outcome.body);
      }
      return {
        body,
        contentType: TYPES[extension] ?? "application/octet-stream",
        cacheControl: isPlaylist ? PLAYLIST_CACHE : SEGMENT_CACHE,
      };
    },
    logo(channelId: string): MediaAnswer {
      if (!knows(channelId)) throw new AppError(ERRORS.channelNotFound, { id: channelId });
      return { body: logoPng(channelId), contentType: "image/png", cacheControl: SEGMENT_CACHE };
    },
  };
}

export type StreamService = ReturnType<typeof createStreamService>;
