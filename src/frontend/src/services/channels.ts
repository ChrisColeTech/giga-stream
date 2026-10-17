import { api } from "./api";
import { SEARCH_DEBOUNCE_MS } from "@/lib/live-constants";
import type { ChannelListAnswer } from "./schemas/channel-schema";
import { ChannelListSchema, LastChannelSchema } from "./schemas/channel-schema";
import { notConnected, type ServiceResult } from "./not-connected";

export interface ChannelQuery {
  readonly query?: string;
  readonly category?: string;
}

export interface ChannelSearchSeams {
  readonly read: typeof readChannels;
  readonly schedule: (callback: () => void, delay: number) => number;
  readonly cancel: (handle: number) => void;
}

const SEARCH_SEAMS: ChannelSearchSeams = {
  read: readChannels,
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: (handle) => window.clearTimeout(handle),
};

/** One latest-only channel query lane, with an injectable clock and request for deterministic tests. */
export class ChannelSearchSession {
  private controller: AbortController | null = null;
  private timer: number | null = null;
  private generation = 0;
  private readonly onResult: (answer: ChannelListAnswer) => void;
  private readonly onRefusal: (error: unknown) => void;
  private readonly seams: ChannelSearchSeams;

  constructor(
    onResult: (answer: ChannelListAnswer) => void,
    onRefusal: (error: unknown) => void,
    seams: ChannelSearchSeams = SEARCH_SEAMS,
  ) {
    this.onResult = onResult;
    this.onRefusal = onRefusal;
    this.seams = seams;
  }

  search(query: ChannelQuery): void {
    this.cancel();
    this.timer = this.seams.schedule(() => {
      this.timer = null;
      this.start(query);
    }, SEARCH_DEBOUNCE_MS);
  }

  readNow(query: ChannelQuery): void {
    this.cancel();
    this.start(query);
  }

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    if (this.timer !== null) this.seams.cancel(this.timer);
    this.timer = null;
  }

  private start(query: ChannelQuery): void {
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    void this.seams.read(query, controller.signal).then(
      (answer) => {
        if (this.generation === generation) this.onResult(answer);
      },
      (error: unknown) => {
        if (this.generation === generation && !controller.signal.aborted) this.onRefusal(error);
      },
    );
  }
}

/** Reads the live view. Empty query values are omitted because the route rejects blank parameters. */
export function readChannels(query: ChannelQuery = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  const value = query.query?.trim();
  if (value) params.set("q", value);
  if (query.category && query.category !== "all") params.set("category", query.category);
  const suffix = params.size === 0 ? "" : `?${params.toString()}`;
  return api(`/api/channels${suffix}`, ChannelListSchema, { signal, area: "Media" });
}

/** Re-reads the backend and probes every published stream. */
export function refreshChannels(signal?: AbortSignal) {
  return api("/api/channels/refresh", ChannelListSchema, { method: "POST", signal, area: "Media" });
}

/** Persists the channel Live should attach on the next launch. */
export function rememberLastChannel(channelId: string, signal?: AbortSignal) {
  return api("/api/channels/last", LastChannelSchema, {
    method: "PATCH",
    body: { channelId },
    signal,
    area: "Media",
  });
}

/** Kept for the still-fixtured Player surface until its own wiring wave. */
export function retryStream(): ServiceResult {
  return notConnected();
}
