import Hls, { ErrorDetails, ErrorTypes, Events } from "hls.js";
import { HLS_TYPE } from "@/constants/preview-copy";
import type { PlayerError, PlayerStatus } from "@/lib/preview-state";

/* The Preview's player (`36` section 8, `29` section 9.7): pure of React and of requests; it drives one `<video>` and,
 * where it runs, hls.js. hls.js whenever it is supported, the browser's own HLS only as the fallback, else the error
 * `unsupported`. Muted, native controls, no quality, track or latency control. `detach` stops everything at once. */

/** The part of a video element the player touches (a test passes a fake). */
export interface PreviewVideo {
  muted: boolean;
  src: string;
  pause(): void;
  load(): void;
  play(): Promise<void>;
  removeAttribute(name: string): void;
  canPlayType(type: string): string;
  addEventListener(type: "error" | "playing", listener: () => void): void;
  removeEventListener(type: "error" | "playing", listener: () => void): void;
}

export interface EngineError {
  readonly type: string;
  readonly details: string;
  readonly fatal: boolean;
}

export interface PreviewEngine<V> {
  attach(video: V): void;
  load(url: string): void;
  onError(listener: (error: EngineError) => void): void;
  destroy(): void;
}

export interface EngineFactory<V> {
  readonly supported: () => boolean;
  readonly create: () => PreviewEngine<V>;
}

const MANIFEST: ReadonlySet<string> = new Set([
  ErrorDetails.MANIFEST_LOAD_ERROR,
  ErrorDetails.MANIFEST_LOAD_TIMEOUT,
  ErrorDetails.MANIFEST_PARSING_ERROR,
]);

/** A fatal hls.js error as the line says it: a manifest that failed, any other network failure, or a media error. */
export function errorOf(error: EngineError): PlayerError | null {
  if (!error.fatal) return null;
  if (error.type === ErrorTypes.NETWORK_ERROR) return MANIFEST.has(error.details) ? "manifest failed" : "unreachable";
  return "media error";
}

/** hls.js over a real video element. */
export const HLS_ENGINES: EngineFactory<HTMLVideoElement> = {
  supported: () => Hls.isSupported(),
  create: () => {
    const hls = new Hls();
    return {
      attach: (video) => hls.attachMedia(video),
      load: (url) => hls.loadSource(url),
      onError: (listener) => hls.on(Events.ERROR, (_event, data) => listener(data)),
      destroy: () => hls.destroy(),
    };
  },
};

export interface PreviewPlayer {
  /** Stops what played, then plays this address. */
  play(url: string): void;
  /** Destroys the engine, pauses, removes the source and loads empty, so every request stops. Harmless twice. */
  detach(): void;
  /** Detaches and lets go of the element's listeners: the window is gone. */
  dispose(): void;
}

export function createPreviewPlayer<V extends PreviewVideo>(
  video: V,
  engines: EngineFactory<V>,
  report: (status: PlayerStatus) => void,
): PreviewPlayer {
  let engine: PreviewEngine<V> | null = null;
  let attached = false;
  const fail = (error: PlayerError): void => report({ phase: "idle", error });
  const onError = (): void => {
    if (attached) fail("media error");
  };
  const onPlaying = (): void => report({ phase: "playing", error: null });
  video.addEventListener("error", onError);
  video.addEventListener("playing", onPlaying);

  function detach(): void {
    attached = false;
    engine?.destroy();
    engine = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  function play(url: string): void {
    detach();
    video.muted = true;
    if (engines.supported()) {
      engine = engines.create();
      engine.onError((error) => {
        const mapped = errorOf(error);
        if (mapped !== null && attached) fail(mapped);
      });
      engine.attach(video);
      engine.load(url);
    } else if (video.canPlayType(HLS_TYPE) !== "") {
      video.src = url;
    } else {
      fail("unsupported");
      return;
    }
    attached = true;
    report({ phase: "loading", error: null });
    void video.play().catch(() => undefined);
  }

  function dispose(): void {
    detach();
    video.removeEventListener("error", onError);
    video.removeEventListener("playing", onPlaying);
  }

  return { play, detach, dispose };
}
