import type { LIVE_CATEGORIES, LIVE_MODES, VariantName } from "../constants/live-media.js";

export type LiveCategory = (typeof LIVE_CATEGORIES)[number];
export type LiveMode = (typeof LIVE_MODES)[number];

/** What the engine needs to build a live channel: how it is encoded and what it plays (exactly one source). */
export interface LiveSpec {
  id: string;
  mode: LiveMode;
  captions: boolean;
  variants: VariantName[];
  folder?: string;
  videos?: string[];
}

/** One video of a running channel's playlist. */
export interface PlaylistEntry {
  name: string;
  durationMs: number;
}

export type ChannelState = "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";

/** A video the channel plays, found and read with ffprobe. */
export interface PlaylistItem {
  /** Its path inside the channel's folder, or its file name when listed. */
  name: string;
  path: string;
  durationMs: number;
  sizeBytes: number;
  modifiedMs: number;
  captionsPath?: string;
}

/** One segment of an encoded rendition; a schedule marks where each video begins. */
export interface Segment {
  uri: string;
  duration: number;
  itemStart?: boolean;
  /** In a schedule: which video and which of its own segments. */
  item?: number;
  local?: number;
}

export interface Rendition {
  uri: string;
  segments: Segment[];
}

/** An encoded video, or a channel's videos joined: what loop mode serves from. */
export interface LoopSource {
  masterText: string;
  renditions: Map<string, Rendition>;
  items?: PlaylistEntry[];
  readSegment(id: string, index: number): Promise<Buffer | null>;
}

/** What runs a channel's stream, in either mode. `read` takes the path parts after /live/:id/. */
export interface StreamBackend {
  mode: LiveMode;
  state(): ChannelState;
  renditions(): string[];
  playlist(): PlaylistEntry[];
  nowPlaying(): { index: number; name: string } | null;
  start(): Promise<void>;
  stop(): Promise<void>;
  read(parts: string[]): Promise<Buffer | null>;
}
