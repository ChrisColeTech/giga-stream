import { useEffect, useRef } from "react";
import { applyEmbedPlayback } from "@/lib/embed-playback";
import type { EmbedPlaybackEvent } from "@/lib/embed-messages";
import type { PlayerSource } from "@/lib/player-sources";
import { useAppStore } from "@/store/app-store";
import type { StageState } from "@/types/player";

export interface ProviderPlaybackInput {
  readonly source: Extract<PlayerSource, { kind: "embed" }>['embed'] | undefined;
  readonly render: string;
  readonly stage: StageState;
  readonly retry: number;
  readonly onProgress: (positionMs: number, durationMs?: number) => void;
  readonly onPausedChange: (paused: boolean) => void;
  readonly onPlaying: (playing: boolean) => void;
  readonly onBoundary: () => void;
}

/** Projects provider messages and failures into playback callbacks and the event log. */
export function useProviderPlayback(input: ProviderPlaybackInput): (event: EmbedPlaybackEvent) => void {
  const rowsAt = useRef(new Map<string, number>());
  useEffect(() => {
    if (input.render === "embed-failed" && input.stage.kind === "failed" && input.source !== undefined) {
      useAppStore.getState().logEvent({
        tone: "warn",
        area: "Provider",
        sentence: "The provider's player failed to load.",
        identity: input.source.name,
      });
    }
  }, [input.render, input.stage.kind, input.retry, input.source]);
  return (event) => {
    const at = Date.now();
    if (input.source !== undefined && at - (rowsAt.current.get(event.event) ?? 0) >= 1000) {
      rowsAt.current.set(event.event, at);
      useAppStore.getState().logEvent({
        tone: "info",
        area: "Provider",
        sentence: `The provider reported ${event.event}.`,
        identity: input.source.name,
      });
    }
    applyEmbedPlayback(event, {
      progress: input.onProgress,
      paused: input.onPausedChange,
      playing: input.onPlaying,
      checkpoint: input.onBoundary,
    });
  };
}
