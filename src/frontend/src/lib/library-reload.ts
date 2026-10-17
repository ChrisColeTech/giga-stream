export interface ReloadInput {
  /** The first pass after mount: the list has never been read. */
  readonly initial: boolean;
  /** Whether the Library is the shown surface now. */
  readonly active: boolean;
  /** The query's key differs from the one the list was last read for. */
  readonly queryChanged: boolean;
  /** `libraryRefreshSerial` was bumped (a Refresh, a watch or favorite write, a scan). */
  readonly serialChanged: boolean;
  /** An invalidation arrived while the surface was hidden and has not been applied yet. */
  readonly dirty: boolean;
}

export interface ReloadDecision {
  readonly reload: boolean;
  /** Carried to the next pass: an invalidation still waiting for the surface to be shown. */
  readonly dirty: boolean;
}

/** Whether the first page must be read again. Showing the surface again is not a reason: surfaces stay mounted, the
 *  list and its scroll position are still valid. Only an invalidation is, and one that lands while the surface is hidden
 *  waits (`dirty`) and is applied when it is shown, so the grid never changes out of sight and jumps into view. */
export function reloadDecision(input: ReloadInput): ReloadDecision {
  if (input.initial) return { reload: true, dirty: false };
  const invalidated = input.queryChanged || input.serialChanged || input.dirty;
  if (!input.active) return { reload: false, dirty: invalidated };
  return { reload: invalidated, dirty: false };
}
