export const EMBED_ALLOW = "autoplay; fullscreen; encrypted-media; picture-in-picture";

export interface EmbedFramePolicy {
  readonly allow: string;
  readonly referrerPolicy: "origin";
}

export function embedFramePolicy(): EmbedFramePolicy {
  return {
    allow: EMBED_ALLOW,
    referrerPolicy: "origin",
  };
}

export interface StoppableFrame {
  src: string;
}

/** Blanks the frame so picture and sound stop at once. The DOM node's owner (React, via the host's key)
 *  removes it; imperatively removing a React-owned node crashes the renderer at the next commit. */
export function stopEmbed(frame: StoppableFrame): void {
  frame.src = "about:blank";
}
