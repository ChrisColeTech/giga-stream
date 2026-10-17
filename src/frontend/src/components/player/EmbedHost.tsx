import { useCallback, useRef } from "react";
import { mountEmbedLifecycle } from "@/lib/embed-lifecycle";
import type { EmbedPlaybackEvent } from "@/lib/embed-messages";
import { embedFramePolicy } from "@/lib/embed-policy";
import { embedUrl } from "@/lib/embed-url";
import { clearPlayerPolicy, setPlayerPolicy } from "@/services/player-policy";
import type { TitleSource } from "@/services/schemas/source-schema";

export interface EmbedHostProps {
  readonly source: TitleSource;
  readonly positionMs: number;
  readonly subtitleLanguage: string | null;
  readonly electron: boolean;
  readonly retry: number;
  readonly onPlayback: (event: EmbedPlaybackEvent) => void;
  readonly onReady: () => void;
}

/** Both runtimes omit iframe sandbox; Electron additionally installs the named main-process policy. */
export function EmbedHost(props: EmbedHostProps) {
  const playback = useRef(props.onPlayback);
  playback.current = props.onPlayback;
  const policy = embedFramePolicy();
  const address = embedUrl(props.source, props.positionMs, props.subtitleLanguage);

  const mount = useCallback((frame: HTMLIFrameElement | null) => {
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

  return (
    <>
      <iframe key={`${address}:${props.retry}`} ref={mount} src="about:blank" title={`${props.source.name} player`}
        allow={policy.allow} allowFullScreen referrerPolicy={policy.referrerPolicy}
        className="size-full border-0 bg-stage"
        onLoad={(event) => { if (event.currentTarget.src !== "about:blank") props.onReady(); }} />
    </>
  );
}
