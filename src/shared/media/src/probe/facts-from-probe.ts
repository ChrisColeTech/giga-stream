import { NO_LENGTH_SENTENCE, NO_VIDEO_SENTENCE } from "../constants/media.ts";
import type { MediaFacts } from "../types/media-facts.ts";

interface ProbeStream {
  codec_type?: unknown;
  codec_name?: unknown;
  width?: unknown;
  height?: unknown;
  avg_frame_rate?: unknown;
  channels?: unknown;
}

const num = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

/** `30000/1001` → 29.97; undefined for `0/0` and anything unreadable. */
function rate(value: unknown): number | undefined {
  const [top, bottom] = String(value ?? "").split("/").map(Number);
  if (!top || !bottom) return undefined;
  return Math.round((top / bottom) * 1000) / 1000;
}

/** Turns ffprobe's JSON (`-show_format -show_streams -of json`) into facts. Pure. */
export function factsFromProbe(json: unknown): MediaFacts {
  const root = (typeof json === "object" && json !== null ? json : {}) as { format?: Record<string, unknown>; streams?: unknown };
  const streams = Array.isArray(root.streams) ? (root.streams as ProbeStream[]) : [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  const seconds = num(root.format?.duration);
  const facts: MediaFacts = {
    playable: video !== undefined && seconds !== undefined && seconds > 0,
    ...(str(root.format?.format_name) && { container: str(root.format?.format_name) }),
    ...(seconds !== undefined && { durationMs: Math.round(seconds * 1000) }),
    ...(num(video?.width) && { width: num(video?.width) }),
    ...(num(video?.height) && { height: num(video?.height) }),
    ...(rate(video?.avg_frame_rate) && { frameRate: rate(video?.avg_frame_rate) }),
    ...(str(video?.codec_name) && { videoCodec: str(video?.codec_name) }),
    ...(str(audio?.codec_name) && { audioCodec: str(audio?.codec_name) }),
    ...(num(audio?.channels) && { audioChannels: num(audio?.channels) }),
  };
  if (!facts.playable) facts.problem = video ? NO_LENGTH_SENTENCE : NO_VIDEO_SENTENCE;
  return facts;
}
