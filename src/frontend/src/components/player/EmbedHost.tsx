import { useEffect, useRef } from "react";
import { decodeAllowedEmbedMessage, type EmbedPlaybackEvent } from "@/lib/embed-messages";
import { embedFramePolicy, stopEmbed } from "@/lib/embed-policy";
import { embedUrl } from "@/lib/embed-url";
import { installFrameGuard } from "@/lib/frame-guard";
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

/** The PoC host: exact-origin messages, browser sandbox, Electron host guards, and destructive cleanup. */
export function EmbedHost(props: EmbedHostProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const address = embedUrl(props.source, props.positionMs, props.subtitleLanguage);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      const decoded = decodeAllowedEmbedMessage(
        props.source,
        event.origin,
        event.source === frame.current?.contentWindow,
        event.data,
      );
      if (decoded !== null) props.onPlayback(decoded);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [props.source, props.onPlayback]);

  useEffect(() => () => {
    const node = frame.current;
    if (node !== null) stopEmbed(node);
  }, [address, props.retry]);

  const policy = embedFramePolicy(props.electron);

  return (
    <>
      {!props.electron && (
        <span className="absolute top-2 right-2 z-10 rounded-ctl bg-panel/90 px-2 py-1 font-mono text-xs text-faint">
          unprotected
        </span>
      )}
      <iframe
        key={`${address}:${props.retry}`}
        ref={frame}
        src={address}
        title={`${props.source.name} player`}
        allow={policy.allow}
        allowFullScreen
        referrerPolicy={policy.referrerPolicy}
        sandbox={policy.sandbox}
        className="size-full border-0 bg-stage"
        onLoad={() => {
          if (frame.current !== null) installFrameGuard(frame.current, props.source.frameOrigins ?? []);
          props.onReady();
        }}
      />
    </>
  );
}
