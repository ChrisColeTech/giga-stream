import type { EmbedPlaybackEvent } from "@/lib/embed-messages";

export interface EmbedPlaybackSink {
  readonly progress: (positionMs: number, durationMs?: number) => void;
  readonly paused: (paused: boolean) => void;
  readonly playing: (playing: boolean) => void;
  readonly checkpoint: () => void;
}

export function applyEmbedPlayback(event: EmbedPlaybackEvent, sink: EmbedPlaybackSink): void {
  if (event.positionMs !== undefined) sink.progress(event.positionMs, event.durationMs);
  if (event.event === "play" || event.event === "playing") {
    sink.paused(false);
    sink.playing(true);
  }
  if (event.event === "pause") {
    sink.paused(true);
    sink.playing(false);
  }
  if (event.event === "ended") {
    sink.paused(true);
    sink.playing(false);
    sink.checkpoint();
  }
}
