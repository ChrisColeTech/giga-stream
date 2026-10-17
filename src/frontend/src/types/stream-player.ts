import type { EventInput } from "@/lib/event-log";
import type { PlaybackPrefs } from "./settings";

export type StreamStageState = "idle" | "loading" | "ready" | "failed";

export interface StreamFacts {
  readonly resolution?: string;
  readonly bitrate?: string;
  readonly aspect?: string;
  readonly liveEdge?: string;
}

export type StreamPreferences = Pick<
  PlaybackPrefs,
  "videoQuality" | "audioLanguage" | "subtitleLanguage" | "lowLatency"
>;

export interface StreamAttachment {
  readonly url: string;
  readonly autoplay: boolean;
  readonly userInitiated: boolean;
}

export interface StreamPlayerCallbacks {
  readonly onState: (state: StreamStageState, reason?: string) => void;
  readonly onFacts: (facts: StreamFacts) => void;
  /** Wave 2.6 can feed these already-scrubbed rows into the events drawer. */
  readonly onEvent?: (event: EventInput) => void;
}
