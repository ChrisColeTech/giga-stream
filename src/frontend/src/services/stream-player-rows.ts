import { hostOf } from "@/lib/event-host";
import type { EventInput } from "@/lib/event-log";

const QUALITY_ROW_MS = 1000;

/** One scrubbed sentence; the host is named in parentheses only when it is known. */
const hosted = (sentence: string, host: string | null): string =>
  host === null ? `${sentence}.` : `${sentence} (${host}).`;

/** The Media event rows of one stream attachment: sentences are already host-only, and quality switches coalesce to
 *  at most one row per second. */
export class StreamRows {
  private lastQualityAt = 0;
  private readonly sink: (event: EventInput) => void;
  private readonly attachmentUrl: () => string | null;

  constructor(sink: (event: EventInput) => void, attachmentUrl: () => string | null) {
    this.sink = sink;
    this.attachmentUrl = attachmentUrl;
  }

  manifest(): void {
    const host = this.host();
    this.send("info", hosted("The stream's manifest loaded", host), host);
  }

  quality(): void {
    const at = Date.now();
    if (at - this.lastQualityAt < QUALITY_ROW_MS) return;
    this.lastQualityAt = at;
    this.send("info", "The stream changed quality.");
  }

  fragment(): void {
    this.send("warn", "A stream fragment stopped loading.");
  }

  fatal(): void {
    this.send("error", "The stream stopped responding.");
  }

  /** A row whose sentence is already fixed, for the failures the engine words itself. */
  fixed(tone: EventInput["tone"], sentence: string): void {
    this.send(tone, sentence);
  }

  private host(): string | null {
    const url = this.attachmentUrl();
    return url === null ? null : hostOf(url);
  }

  private send(tone: EventInput["tone"], sentence: string, identity?: string | null): void {
    this.sink({ tone, area: "Media", sentence, ...(identity ? { identity } : {}) });
  }
}
