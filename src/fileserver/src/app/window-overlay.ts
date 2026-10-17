export const SET_OVERLAY_CHANNEL = "poc:set-overlay";

type OverlayIpcEvent = { senderFrame?: { readonly frameTreeNodeId: number } | null };
type OverlayIpc = {
  handle: (channel: string, listener: (event: OverlayIpcEvent, ...args: unknown[]) => unknown) => void;
};

/** The one overlay update the page may send, every field optional. */
type OverlayUpdate = { color?: string; symbolColor?: string; height?: number };

/** What the overlay needs of the window: `BrowserWindow` satisfies it, and a test can pass a plain fake. */
type OverlayWindow = { isDestroyed: () => boolean; setTitleBarOverlay: (overlay: OverlayUpdate) => void };

/* Six digits, or the short form the tokens use where a colour is a plain black (Theatre's `#000`): a short value was
 * refused before, which silently dropped Theatre's colour and left the strip on the previous theme's tone. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexOf(value: unknown): string | undefined {
  if (typeof value !== "string" || !HEX.test(value)) return undefined;
  return value.length === 4 ? value.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : value;
}

function heightOf(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(Math.round(value), 1), 200);
}

/** The overlay update the page sent, or a refusal: shapes and value ranges are checked here, never trusted. */
function overlayOf(value: unknown, ...extra: unknown[]): OverlayUpdate {
  if (extra.length !== 0) throw new TypeError("The overlay accepts one value.");
  if (typeof value !== "object" || value === null) throw new TypeError("The overlay accepts an object.");
  const record = value as Record<string, unknown>;
  const color = hexOf(record.color);
  const symbolColor = hexOf(record.symbolColor);
  const height = heightOf(record.height);
  if (color === undefined && symbolColor === undefined && height === undefined) {
    throw new TypeError("The overlay accepts a colour, a symbol colour or a height.");
  }
  return {
    ...(color === undefined ? {} : { color }),
    ...(symbolColor === undefined ? {} : { symbolColor }),
    ...(height === undefined ? {} : { height }),
  };
}

/**
 * The Windows caption strip (`main.ts`'s titleBarOverlay) is painted by the OS, so the page asks for its
 * colours and height here: the theme and Theatre mode are the page's token remaps, and the page applies its
 * own UI zoom that rescales the 40px bar under the fixed strip. App frame only; off Windows or without an
 * overlay the update is refused, not thrown.
 */
export function installWindowOverlayIpc(
  ipc: OverlayIpc,
  appFrameId: () => number,
  window: () => OverlayWindow | null,
): void {
  ipc.handle(SET_OVERLAY_CHANNEL, (event, value: unknown, ...extra: unknown[]) => {
    if (event.senderFrame?.frameTreeNodeId !== appFrameId()) {
      throw new Error("The overlay is available only to the app frame.");
    }
    const overlay = overlayOf(value, ...extra);
    const target = window();
    if (target === null || target.isDestroyed()) return false;
    try {
      target.setTitleBarOverlay(overlay);
      return true;
    } catch {
      return false;
    }
  });
}
