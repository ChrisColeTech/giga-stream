import Hls, { Events } from "hls.js";

export interface StreamLevel {
  readonly width?: number;
  readonly height?: number;
  readonly bitrate: number;
}

export interface StreamTrack {
  readonly lang?: string;
  readonly name: string;
}

export interface StreamEngine {
  readonly levels: readonly StreamLevel[];
  readonly audioTracks: readonly StreamTrack[];
  readonly subtitleTracks: readonly StreamTrack[];
  readonly liveSyncPosition?: number;
  currentLevel: number;
  audioTrack: number;
  subtitleTrack: number;
  setLowLatency(value: boolean): void;
  attach(video: HTMLVideoElement): void;
  load(url: string): void;
  onManifest(callback: () => void): void;
  onLevel(callback: () => void): void;
  onFragmentError(callback: (reason: string) => void): void;
  onFatal(callback: (reason: string) => void): void;
  destroy(): void;
}

export interface StreamEngineFactory {
  readonly supported: () => boolean;
  readonly create: (lowLatency: boolean) => StreamEngine;
}

class HlsEngine implements StreamEngine {
  readonly instance: Hls;

  constructor(lowLatency: boolean) {
    this.instance = new Hls({ lowLatencyMode: lowLatency });
  }

  get levels(): readonly StreamLevel[] {
    return this.instance.levels;
  }

  get audioTracks(): readonly StreamTrack[] {
    return this.instance.audioTracks;
  }

  get subtitleTracks(): readonly StreamTrack[] {
    return this.instance.subtitleTracks;
  }

  get liveSyncPosition(): number | undefined {
    return this.instance.liveSyncPosition ?? undefined;
  }

  get currentLevel(): number {
    return this.instance.currentLevel;
  }

  set currentLevel(value: number) {
    this.instance.currentLevel = value;
  }

  get audioTrack(): number {
    return this.instance.audioTrack;
  }

  set audioTrack(value: number) {
    this.instance.audioTrack = value;
  }

  get subtitleTrack(): number {
    return this.instance.subtitleTrack;
  }

  set subtitleTrack(value: number) {
    this.instance.subtitleTrack = value;
  }

  setLowLatency(value: boolean): void {
    this.instance.config.lowLatencyMode = value;
  }

  attach(video: HTMLVideoElement): void {
    this.instance.attachMedia(video);
  }

  load(url: string): void {
    this.instance.loadSource(url);
  }

  onManifest(callback: () => void): void {
    this.instance.on(Events.MANIFEST_PARSED, callback);
  }

  onLevel(callback: () => void): void {
    this.instance.on(Events.LEVEL_SWITCHED, callback);
  }

  onFragmentError(callback: (reason: string) => void): void {
    this.instance.on(Events.ERROR, (_event, data) => {
      if (String(data.details).toLowerCase().includes("frag")) callback("A stream fragment stopped loading.");
    });
  }

  onFatal(callback: (reason: string) => void): void {
    this.instance.on(Events.ERROR, (_event, data) => {
      if (data.fatal) callback("The stream stopped responding.");
    });
  }

  destroy(): void {
    this.instance.destroy();
  }
}

export const HLS_ENGINE_FACTORY: StreamEngineFactory = {
  supported: () => Hls.isSupported(),
  create: (lowLatency) => new HlsEngine(lowLatency),
};
