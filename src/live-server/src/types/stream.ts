import type { ChannelState, PlaylistEntry } from "./channel.ts";

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
  mode: "loop" | "encode";
  state(): ChannelState;
  renditions(): string[];
  playlist(): PlaylistEntry[];
  nowPlaying(): { index: number; name: string } | null;
  start(): Promise<void>;
  stop(): Promise<void>;
  read(parts: string[]): Promise<Buffer | null>;
}
