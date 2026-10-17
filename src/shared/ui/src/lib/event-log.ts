/** The tone of an events row or a notice: the word and the colour say the same thing. */
export type EventTone = "info" | "warn" | "error";

/** A row of the events log. The sentence is already normalised; no secret, path, token or stack trace is ever in it. */
export interface EventRow<Area extends string = string> {
  readonly id: string;
  /** Unix milliseconds. */
  readonly at: number;
  readonly tone: EventTone;
  readonly area: Area;
  readonly sentence: string;
  /** A short identity, when the row is about one item. */
  readonly identity?: string;
}

export type EventInput<Area extends string = string> = Omit<EventRow<Area>, "id" | "at"> & {
  readonly id?: string;
  readonly at?: number;
};

/** The newest rows kept; an older row falls off the front. */
export const EVENT_LOG_LIMIT = 200;

export function appendEvent<Area extends string>(
  rows: readonly EventRow<Area>[],
  input: EventInput<Area>,
  now = Date.now(),
): readonly EventRow<Area>[] {
  const row: EventRow<Area> = {
    ...input,
    id: input.id ?? `event-${now}-${rows.length}`,
    at: input.at ?? now,
  };
  return [...rows, row].slice(-EVENT_LOG_LIMIT);
}

/** The outcome of a request: its HTTP status, or why it never got one. */
export type RequestOutcome = number | "aborted" | "invalid" | "unreachable";

/** One finished request as a row. The host word is the program's own (`fileserver`, `backend`); the address never
 *  is. */
export function restEvent<Area extends string>(
  host: string,
  method: string,
  status: RequestOutcome,
  elapsedMs: number,
  area: Area,
): EventInput<Area> {
  const failed = status === "invalid" || status === "unreachable" || (typeof status === "number" && status >= 400);
  return {
    tone: failed ? "warn" : "info",
    area,
    sentence: `${method.toUpperCase()} ${host} ${status} in ${Math.max(0, Math.round(elapsedMs))} ms.`,
  };
}
