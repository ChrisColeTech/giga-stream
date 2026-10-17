import type { StreamAttachment } from "@/types/stream-player";

export interface LiveStreamTarget {
  readonly attach: (attachment: StreamAttachment) => void;
}

let target: LiveStreamTarget | null = null;
let pending: { readonly attachment: StreamAttachment; readonly serial: number } | null = null;
let handledSerial = 0;

export function registerLiveStreamTarget(next: LiveStreamTarget, currentSerial: number): () => void {
  target = next;
  if (currentSerial === 0) {
    pending = null;
    handledSerial = 0;
  } else if (pending?.serial === currentSerial) {
    next.attach(pending.attachment);
    handledSerial = pending.serial;
  }
  return () => {
    if (target === next) target = null;
  };
}

/** Called inside click/keydown handlers so play() retains the browser's user activation. */
export function requestLiveStream(attachment: StreamAttachment, serial: number): void {
  pending = { attachment, serial };
  if (target !== null) {
    target.attach(attachment);
    handledSerial = serial;
  }
}

/** Catches unattended hydration and controllers mounted after a request without replaying handled gestures. */
export function syncLiveStream(attachment: StreamAttachment, serial: number): void {
  pending = { attachment, serial };
  if (target !== null && serial > handledSerial) {
    target.attach(attachment);
    handledSerial = serial;
  }
}
