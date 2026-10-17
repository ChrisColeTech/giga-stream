import type { EventInput } from "@/lib/event-log";
import type {
  StreamAttachment,
  StreamFacts,
  StreamPlayerCallbacks,
  StreamPreferences,
} from "@/types/stream-player";
import { HLS_ENGINE_FACTORY, type StreamEngine, type StreamEngineFactory } from "./stream-player-engine";

const HLS_MIME = "application/vnd.apple.mpegurl";

const hostOf = (url: string): string => new URL(url).host;
const matchingTrack = (tracks: readonly { readonly lang?: string }[], language: string | null): number =>
  language === null ? -1 : tracks.findIndex((track) => track.lang?.toLowerCase() === language.toLowerCase());

export class StreamPlayerController {
  private engine: StreamEngine | null = null;
  private attachment: StreamAttachment | null = null;
  private preferences: StreamPreferences;
  private readonly video: HTMLVideoElement;
  private readonly callbacks: StreamPlayerCallbacks;
  private readonly engines: StreamEngineFactory;

  constructor(
    video: HTMLVideoElement,
    preferences: StreamPreferences,
    callbacks: StreamPlayerCallbacks,
    engines: StreamEngineFactory = HLS_ENGINE_FACTORY,
  ) {
    this.video = video;
    this.preferences = preferences;
    this.callbacks = callbacks;
    this.engines = engines;
    video.addEventListener("loadeddata", this.onFirstFrame);
    video.addEventListener("error", this.onNativeError);
    video.addEventListener("timeupdate", this.reportFacts);
  }

  attach(attachment: StreamAttachment): void {
    this.detachMedia();
    this.attachment = attachment;
    this.callbacks.onState("loading");
    if (this.engines.supported()) {
      this.attachHls(attachment);
      return;
    }
    if (this.video.canPlayType(HLS_MIME) !== "") {
      this.video.src = attachment.url;
      this.applyNativeCaptions();
      this.video.load();
      this.attemptPlay(attachment);
      return;
    }
    this.fail("This browser cannot play HLS streams.");
  }

  retry(): void {
    if (this.attachment !== null) this.attach({ ...this.attachment, userInitiated: true });
  }

  updatePreferences(preferences: StreamPreferences): void {
    this.preferences = preferences;
    this.applyEnginePreferences();
    this.applyNativeCaptions();
  }

  detach(): void {
    this.attachment = null;
    this.detachMedia();
    this.callbacks.onFacts({});
    this.callbacks.onState("idle");
  }

  destroy(): void {
    this.attachment = null;
    this.detachMedia();
    this.video.removeEventListener("loadeddata", this.onFirstFrame);
    this.video.removeEventListener("error", this.onNativeError);
    this.video.removeEventListener("timeupdate", this.reportFacts);
  }

  private attachHls(attachment: StreamAttachment): void {
    const engine = this.engines.create(this.preferences.lowLatency);
    this.engine = engine;
    engine.onManifest(() => {
      this.emit("info", "Stream manifest loaded.");
      this.applyEnginePreferences();
      this.reportFacts();
      this.attemptPlay(attachment);
    });
    engine.onLevel(() => {
      this.emit("info", "Stream quality changed.");
      this.reportFacts();
    });
    engine.onFragmentError((reason) => this.emit("warn", reason));
    engine.onFatal((reason) => this.fail(reason));
    engine.attach(this.video);
    engine.load(attachment.url);
    this.attemptPlay(attachment);
  }

  private applyEnginePreferences(): void {
    const engine = this.engine;
    if (engine === null) return;
    const quality = this.preferences.videoQuality;
    engine.setLowLatency(this.preferences.lowLatency);
    engine.currentLevel = quality === "auto" ? -1 : quality === "saver" ? 0 : engine.levels.length - 1;
    const audio = matchingTrack(engine.audioTracks, this.preferences.audioLanguage);
    engine.audioTrack = audio;
    engine.subtitleTrack = matchingTrack(engine.subtitleTracks, this.preferences.subtitleLanguage);
  }

  private applyNativeCaptions(): void {
    const wanted = this.preferences.subtitleLanguage?.toLowerCase();
    for (const track of this.video.textTracks) {
      track.mode = wanted !== undefined && track.language.toLowerCase() === wanted ? "showing" : "disabled";
    }
  }

  private readonly attemptPlay = (attachment: StreamAttachment): void => {
    if (!attachment.userInitiated && !attachment.autoplay) return;
    void this.video.play().catch(() => undefined);
  };

  private readonly onFirstFrame = (): void => {
    this.callbacks.onState("ready");
    this.reportFacts();
  };

  private readonly onNativeError = (): void => {
    if (this.attachment !== null) this.fail("The stream could not be loaded.");
  };

  private readonly reportFacts = (): void => {
    const level = this.engine?.levels[this.engine.currentLevel];
    const width = level?.width ?? this.video.videoWidth;
    const height = level?.height ?? this.video.videoHeight;
    const edge = this.engine?.liveSyncPosition;
    const facts: StreamFacts = {
      ...(width > 0 && height > 0 ? { resolution: `${width} x ${height}`, aspect: `${width}:${height}` } : {}),
      ...(level?.bitrate ? { bitrate: `${Math.round(level.bitrate / 1000)} kb/s` } : {}),
      ...(edge === undefined ? {} : { liveEdge: `${Math.max(0, edge - this.video.currentTime).toFixed(1)} s` }),
    };
    this.callbacks.onFacts(facts);
  };

  private fail(reason: string): void {
    this.emit("error", reason);
    this.callbacks.onState("failed", reason);
  }

  private emit(tone: EventInput["tone"], sentence: string): void {
    const url = this.attachment?.url;
    this.callbacks.onEvent?.({ tone, area: "Media", sentence, ...(url ? { identity: hostOf(url) } : {}) });
  }

  private detachMedia(): void {
    this.engine?.destroy();
    this.engine = null;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
  }
}
