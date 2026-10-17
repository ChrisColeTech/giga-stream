/** The areas an event row belongs to (`06` section 7). */
export type EventArea = "Connection" | "Catalog" | "Scan" | "Media" | "Playback" | "Provider";

/** A row of the events drawer. The sentence is already normalised; no secret, path, token or stack trace is ever in it. */
export interface EventRow {
  readonly id: string;
  /** Unix milliseconds. */
  readonly at: number;
  readonly tone: "info" | "warn" | "error";
  readonly area: EventArea;
  readonly sentence: string;
  /** A short identity, when the row is about one item. */
  readonly identity?: string;
}
