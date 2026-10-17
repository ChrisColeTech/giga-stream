import type { WatchWrite } from "@/services/watch";
import type { ItemRef } from "@/types/library";

export const PROGRESS_INTERVAL_MS = 30_000;
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

type Write = (value: WatchWrite) => Promise<unknown>;

/** One playback's monotonic write stream. The server rejects stale sequence numbers from late requests. */
export class PlayerProgress {
  private readonly playbackId: string;
  private readonly write: Write;
  private readonly identity: ProgressIdentity;
  private seq = 0;
  private positionMs = 0;
  private durationMs: number | undefined;
  private enabled: boolean;
  private hasPosition = false;

  constructor(identity: ProgressIdentity, enabled: boolean, write: Write, playbackId: string = crypto.randomUUID()) {
    this.identity = identity;
    this.enabled = enabled;
    this.write = write;
    this.playbackId = playbackId;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  update(positionMs: number, durationMs?: number): void {
    this.hasPosition = true;
    this.positionMs = Math.max(0, Math.round(positionMs));
    this.durationMs = durationMs === undefined || durationMs <= 0 ? undefined : Math.round(durationMs);
  }

  flush(): Promise<unknown> {
    if (!this.enabled || !this.hasPosition) return Promise.resolve(undefined);
    this.seq += 1;
    return this.write({
      item: this.identity.item,
      ...(this.identity.season === undefined ? {} : { season: this.identity.season }),
      ...(this.identity.episode === undefined ? {} : { episode: this.identity.episode }),
      positionMs: this.positionMs,
      ...(this.durationMs === undefined ? {} : { durationMs: this.durationMs }),
      playbackId: this.playbackId,
      seq: this.seq,
    });
  }
}
