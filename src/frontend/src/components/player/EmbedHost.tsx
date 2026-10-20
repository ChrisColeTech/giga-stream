import type { EmbedPlaybackEvent } from "@/lib/embed-messages";
import { useEmbedHost } from "@/hooks/useEmbedHost";
import type { TitleSource } from "@/types/title";

export interface EmbedHostProps {
  readonly source: TitleSource;
  readonly positionMs: number;
  readonly subtitleLanguage: string | null;
  readonly electron: boolean;
  readonly retry: number;
  readonly onPlayback: (event: EmbedPlaybackEvent) => void;
  readonly onReady: () => void;
}

/** Both runtimes omit iframe sandbox; Electron additionally installs the named main-process policy. Hijack refusals
 *  and dialog no-ops are decided by that policy and arrive as guard reports, so this host never logs them itself. */
export function EmbedHost(props: EmbedHostProps) {
  const host = useEmbedHost(props);

  return (
    <>
      <iframe key={`${host.address}:${props.retry}`} ref={host.mount} src="about:blank" title={`${props.source.name} player`}
        allow={host.policy.allow} allowFullScreen referrerPolicy={host.policy.referrerPolicy}
        className="size-full border-0 bg-stage"
        onLoad={(event) => host.onLoad(event.currentTarget)} />
    </>
  );
}
