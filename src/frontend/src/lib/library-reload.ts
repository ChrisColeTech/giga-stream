export interface ReloadInput {
  /** The first pass after mount: the list has never been read. */
  readonly initial: boolean;
  /** The hook lifecycle cancelled its read, so a replayed setup must replace it. */
  readonly interrupted?: boolean;
  /** Whether the Library is the shown surface now. */
  readonly active: boolean;
  /** The query's key differs from the one the list was last read for. */
  readonly queryChanged: boolean;
  /** `libraryRefreshSerial` was bumped (a Refresh, a watch or favorite write, a scan). */
  readonly serialChanged: boolean;
  /** The session started or ended (`63` section 3.3): the watch truth changed home, so the rows are read again. */
  readonly sessionChanged?: boolean;
  /** An invalidation arrived while the surface was hidden and has not been applied yet. */
  readonly dirty: boolean;
  /** The saved Library state has been applied (or could not be): until then nothing is read, so the first read already
   *  uses the restored query and the unfiltered list never shows. Optional so callers that need no gate omit it. */
  readonly ready?: boolean;
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
  if (input.ready === false) return { reload: false, dirty: input.dirty };
  if (input.initial || input.interrupted === true) return { reload: true, dirty: false };
  const invalidated = input.queryChanged || input.serialChanged || input.sessionChanged === true || input.dirty;
  if (!input.active) return { reload: false, dirty: invalidated };
  return { reload: invalidated, dirty: false };
}
