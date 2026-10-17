import { originOf } from "./navigation.js";

/** The part of an IPC event the trust check reads: the frame that sent it. */
export type IpcSender = { senderFrame?: { readonly frameTreeNodeId: number; readonly url: string } | null };

/**
 * Whether an IPC call comes from the admin's own page: the window's MAIN frame, at one of the origins the window may
 * load. A nested frame, a detached sender or any other origin is refused, since the host's two capabilities (a native
 * folder picker, the caption strip's colours) belong to the app alone.
 */
export function isTrustedSender(
  event: IpcSender,
  mainFrameId: () => number,
  allowed: ReadonlySet<string>,
): boolean {
  const frame = event.senderFrame;
  if (frame === null || frame === undefined) return false;
  if (frame.frameTreeNodeId !== mainFrameId()) return false;
  const origin = originOf(frame.url);
  return origin !== null && allowed.has(origin);
}
