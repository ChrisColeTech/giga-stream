export const EMBED_ALLOW = "autoplay; fullscreen; encrypted-media; picture-in-picture";
export const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-presentation";

export interface EmbedFramePolicy {
  readonly allow: string;
  readonly referrerPolicy: "origin";
  readonly sandbox?: string;
}

export function embedFramePolicy(electron: boolean): EmbedFramePolicy {
  return {
    allow: EMBED_ALLOW,
    referrerPolicy: "origin",
    ...(electron ? {} : { sandbox: EMBED_SANDBOX }),
  };
}

export interface RemovableFrame {
  src: string;
  remove(): void;
}

export function stopEmbed(frame: RemovableFrame): void {
  frame.src = "about:blank";
  frame.remove();
}
