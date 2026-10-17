import { writeDue } from "@/lib/watch-throttle";
import type { WatchWrite } from "@/services/watch";
import type { ItemRef } from "@/types/library";

export const FINAL_PROGRESS_TIMEOUT_MS = 1_000;

export class ProgressBeginQueue {
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();

  begin(flush: () => Promise<void>, install: () => void): Promise<boolean> {
    this.generation += 1;
    const generation = this.generation;
    const operation = this.queue.then(async () => {
      if (generation !== this.generation) return false;
      await flush();
      if (generation !== this.generation) return false;
      install();
      return true;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  /** Resolves once every begin asked for so far has installed its recorder (or been superseded). */
  settled(): Promise<void> {
    return this.queue;
  }
}

export async function settleFinalProgress(write: Promise<void>): Promise<void> {
  await Promise.race([
    write,
    new Promise<void>((resolve) => setTimeout(resolve, FINAL_PROGRESS_TIMEOUT_MS)),
  ]);
}

export interface ProgressIdentity {
  readonly item: ItemRef;
  readonly season?: number;
  readonly episode?: number;
}

type Write = (value: WatchWrite, keepalive: boolean) => Promise<unknown>;

/**
 * One playback's monotonic write stream (docs/30 section 3.2). The server rejects stale sequence numbers, so a late
 * request never rewinds progress. This class decides WHEN a write is sent (open, a due position, a boundary); the
 * hook decides what triggers each call. Nothing here reads a clock: the throttle is media time.
 */
export class PlayerProgress {
  /** The playback this recorder belongs to (the Player's playback key), so a late `open` finds its own session. */
  readonly key: string;
  private readonly playbackId: string;
  private readonly write: Write;
  private readonly identity: ProgressIdentity;
  private seq = 0;
  private positionMs = 0;
  private durationMs: number | undefined;
  private lastSentMs: number | undefined;
  private sentDuration: number | undefined;
  private enabled: boolean;
  private opened = false;
  private hasPosition = false;

  constructor(
    identity: ProgressIdentity,
    enabled: boolean,
    write: Write,
    playbackId: string = crypto.randomUUID(),
    key = "",
  ) {
    this.identity = identity;
    this.enabled = enabled;
    this.write = write;
    this.playbackId = playbackId;
    this.key = key;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Play was pressed: record the item at the position it will start from. Once per playback. */
  open(positionMs: number): Promise<unknown> | undefined {
    if (this.opened) return undefined;
    this.opened = true;
    this.record(positionMs);
    return this.send(false);
  }

  /** A media report. Answers the write when one is due: the first of a playback, the first time the duration is
   *  known, or a move of at least the throttle in media time either way. */
  update(positionMs: number, durationMs?: number): Promise<unknown> | undefined {
    this.opened = true;
    this.record(positionMs, durationMs);
    const learned = this.durationMs !== undefined && this.sentDuration === undefined;
    return learned || writeDue(this.lastSentMs, this.positionMs) ? this.send(false) : undefined;
  }

  /** Start over: the saved position is replaced by zero at once. */
  restart(): Promise<unknown> {
    this.record(0);
    return this.send(false);
  }

  /** A boundary (pause, end, hide, close, switch): write the last known position now. */
  flush(keepalive = false): Promise<unknown> {
    return this.hasPosition ? this.send(keepalive) : Promise.resolve(undefined);
  }

  private record(positionMs: number, durationMs?: number): void {
    this.hasPosition = true;
    this.positionMs = Math.max(0, Math.round(positionMs));
    // A report without a duration keeps the last one known (a provider message may carry position alone).
    if (durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0) {
      this.durationMs = Math.round(durationMs);
    }
  }

  private send(keepalive: boolean): Promise<unknown> {
    if (!this.enabled) return Promise.resolve(undefined);
    this.seq += 1;
    this.lastSentMs = this.positionMs;
    this.sentDuration = this.durationMs;
    return this.write({
      item: this.identity.item,
      ...(this.identity.season === undefined ? {} : { season: this.identity.season }),
      ...(this.identity.episode === undefined ? {} : { episode: this.identity.episode }),
      positionMs: this.positionMs,
      ...(this.durationMs === undefined ? {} : { durationMs: this.durationMs }),
      playbackId: this.playbackId,
      seq: this.seq,
    }, keepalive);
  }
}
