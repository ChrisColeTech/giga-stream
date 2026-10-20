import { useCallback, useEffect, useRef } from "react";
import { mountEmbedLifecycle } from "@/lib/embed-lifecycle";
import type { EmbedPlaybackEvent } from "@/lib/embed-messages";
import { blankForStop, embedFramePolicy } from "@/lib/embed-policy";
import { embedUrl } from "@/lib/embed-url";
import { hostOf } from "@/lib/event-host";
import { clearPlayerPolicy, setPlayerPolicy } from "@/services/player-policy";
import { useAppStore } from "@/store/app-store";
import type { TitleSource } from "@/types/title";

export interface EmbedHostInput {
  readonly source: TitleSource;
  readonly positionMs: number;
  readonly subtitleLanguage: string | null;
  readonly electron: boolean;
  readonly onPlayback: (event: EmbedPlaybackEvent) => void;
  readonly onReady: () => void;
}

/** Owns provider-frame policy, message lifecycle, navigation and stop requests. */
export function useEmbedHost(input: EmbedHostInput) {
  const playback = useRef(input.onPlayback);
  playback.current = input.onPlayback;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stopRequest = useAppStore((state) => state.stopRequest);
  const address = embedUrl(input.source, input.positionMs, input.subtitleLanguage);
  const policy = embedFramePolicy();
  const mount = useCallback((frame: HTMLIFrameElement | null) => {
    frameRef.current = frame;
    if (frame === null) return undefined;
    if (input.electron && !setPlayerPolicy({
      origin: input.source.origin,
      frameOrigins: input.source.frameOrigins ?? [],
    })) return undefined;
    const dispose = mountEmbedLifecycle(
      frame,
      input.source,
      window,
      (event) => playback.current(event),
      input.electron ? clearPlayerPolicy : () => undefined,
    );
    frame.src = address;
    return dispose;
  }, [address, input.electron, input.source]);
  const onLoad = useCallback((element: HTMLIFrameElement) => {
    if (element.src === "about:blank") return;
    useAppStore.getState().logEvent({
      tone: "info",
      area: "Provider",
      sentence: `The provider's player loaded (${hostOf(input.source.origin) ?? input.source.name}).`,
      identity: input.source.name,
    });
    input.onReady();
  }, [input.onReady, input.source]);
  useEffect(() => {
    if (stopRequest !== 0) blankForStop(frameRef.current);
  }, [stopRequest]);
  return { address, policy, mount, onLoad };
}
