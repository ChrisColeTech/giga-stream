import type { TitleSource } from "@/services/schemas/source-schema";

export interface EmbedPlaybackEvent {
  readonly event: string;
  readonly positionMs?: number;
  readonly durationMs?: number;
}

type RecordValue = Readonly<Record<string, unknown>>;

const record = (value: unknown): RecordValue | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
const seconds = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : undefined;
const result = (event: unknown, position: unknown, duration: unknown): EmbedPlaybackEvent | null => {
  if (typeof event !== "string" || event.length === 0) return null;
  const positionMs = seconds(position);
  const durationMs = seconds(duration);
  return { event, ...(positionMs === undefined ? {} : { positionMs }), ...(durationMs === undefined ? {} : { durationMs }) };
};

function parsed(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** The PoC decode table. Callers must first establish the exact origin and frame window. */
export function decodeEmbedMessage(source: TitleSource, value: unknown): EmbedPlaybackEvent | null {
  const data = record(parsed(value));
  if (data === null) return null;
  if (data.type === "MEDIA_DATA") {
    const payload = record(data.data) ?? data;
    return result("media-data", payload.currentTime ?? payload.position, payload.duration);
  }
  if (data.type !== "PLAYER_EVENT") return null;
  const payload = record(data.data);
  if (source.messageShape === "vidsrc-status" && payload !== null) {
    return result(payload.player_status, payload.player_progress, payload.player_duration);
  }
  const observed = record(data.event);
  if (observed !== null) return result(observed.event, observed.currentTime, observed.duration);
  if (source.messageShape === "player-event" && payload !== null) {
    return result(payload.event, payload.currentTime, payload.duration);
  }
  return null;
}

export function decodeAllowedEmbedMessage(
  source: TitleSource,
  origin: string,
  fromActiveFrame: boolean,
  value: unknown,
): EmbedPlaybackEvent | null {
  if (origin !== source.origin || !fromActiveFrame) return null;
  return decodeEmbedMessage(source, value);
}
