import { decodeAllowedEmbedMessage, type EmbedPlaybackEvent } from "@/lib/embed-messages";
import { stopEmbed, type StoppableFrame } from "@/lib/embed-policy";
import type { TitleSource } from "@/services/schemas/source-schema";

export interface EmbedFrame extends StoppableFrame {
  readonly contentWindow: MessageEventSource | null;
}

export interface EmbedMessageTarget {
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
}

/** Captures one concrete frame and removes its listener before blanking that same frame. */
export function mountEmbedLifecycle(
  frame: EmbedFrame,
  source: TitleSource,
  target: EmbedMessageTarget,
  onPlayback: (event: EmbedPlaybackEvent) => void,
  clearPolicy: () => void,
): () => void {
  const receive = (event: MessageEvent<unknown>) => {
    const decoded = decodeAllowedEmbedMessage(
      source,
      event.origin,
      event.source === frame.contentWindow,
      event.data,
    );
    if (decoded !== null) onPlayback(decoded);
  };
  target.addEventListener("message", receive);
  return () => {
    target.removeEventListener("message", receive);
    stopEmbed(frame);
    clearPolicy();
  };
}
