export interface LatestRequest {
  /** A new query starts: the previous one's signal is aborted and a fresh one is returned. */
  readonly next: () => AbortSignal;
  /** The signal of the query the list is on (a later page of it asks with this). */
  readonly current: () => AbortSignal;
}

/** The newest request owns the list (`docs/41` section 6): starting another aborts the one in flight, so the browser
 *  stops waiting for an answer nobody will show. The slice's key rule still drops an answer that arrives anyway. */
export function createLatestRequest(): LatestRequest {
  let controller = new AbortController();
  return {
    next: () => {
      controller.abort();
      controller = new AbortController();
      return controller.signal;
    },
    current: () => controller.signal,
  };
}
