import { useCallback, useEffect, useRef } from "react";
import { mountEmbedLifecycle } from "@/lib/embed-lifecycle";
import type { EmbedPlaybackEvent } from "@/lib/embed-messages";
import { embedFramePolicy, stopEmbed, type StoppableFrame } from "@/lib/embed-policy";
import { embedUrl } from "@/lib/embed-url";
import { hostOf } from "@/lib/event-host";
import { clearPlayerPolicy, setPlayerPolicy } from "@/services/player-policy";
import type { TitleSource } from "@/services/schemas/source-schema";
import { useAppStore } from "@/store/app-store";

export interface EmbedHostProps {
  readonly source: TitleSource;
  readonly positionMs: number;
  readonly subtitleLanguage: string | null;
  readonly electron: boolean;
  readonly retry: number;
  readonly onPlayback: (event: EmbedPlaybackEvent) => void;
  readonly onReady: () => void;
}

/** Stop's embed action (`50` section 2.4): blank the frame through the embed policy — a provider iframe cannot be
 *  paused from outside. */
export function blankForStop(frame: StoppableFrame | null | undefined): void {
  if (frame !== null && frame !== undefined) stopEmbed(frame);
}

/** Both runtimes omit iframe sandbox; Electron additionally installs the named main-process policy. Hijack refusals
 *  and dialog no-ops are decided by that policy and arrive as guard reports, so this host never logs them itself. */
export function EmbedHost(props: EmbedHostProps) {
  const playback = useRef(props.onPlayback);
  playback.current = props.onPlayback;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stopRequest = useAppStore((state) => state.stopRequest);
  const policy = embedFramePolicy();
  const address = embedUrl(props.source, props.positionMs, props.subtitleLanguage);
  const loadedSentence = `The provider's player loaded (${hostOf(props.source.origin) ?? props.source.name}).`;

  const announceLoaded = useCallback((element: HTMLIFrameElement) => {
    if (element.src === "about:blank") return;
    useAppStore.getState().logEvent({
      tone: "info",
      area: "Provider",
      sentence: loadedSentence,
      identity: props.source.name,
    });
    props.onReady();
  }, [loadedSentence, props.onReady, props.source.name]);

  const mount = useCallback((frame: HTMLIFrameElement | null) => {
    frameRef.current = frame;
    if (frame === null) return undefined;
    if (props.electron && !setPlayerPolicy({
      origin: props.source.origin,
      frameOrigins: props.source.frameOrigins ?? [],
    })) {
      return undefined;
    }
    const dispose = mountEmbedLifecycle(
      frame,
      props.source,
      window,
      (event) => playback.current(event),
      props.electron ? clearPlayerPolicy : () => undefined,
    );
    frame.src = address;
    return dispose;
  }, [address, props.electron, props.source]);

  /* Stop (`50` section 2.4): the serial's change blanks the frame; reopening the source plays again. */
  useEffect(() => {
    if (stopRequest === 0) return;
    blankForStop(frameRef.current);
  }, [stopRequest]);

  return (
    <>
      <iframe key={`${address}:${props.retry}`} ref={mount} src="about:blank" title={`${props.source.name} player`}
        allow={policy.allow} allowFullScreen referrerPolicy={policy.referrerPolicy}
        className="size-full border-0 bg-stage"
        onLoad={(event) => announceLoaded(event.currentTarget)} />
    </>
  );
}
