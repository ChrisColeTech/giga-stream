import { PAGE_SIZE } from "@giga/ui/lib/window-constants";
import { unreadableTitles } from "@/constants/title-copy";
import { isLoaded, isLoading, pageOf } from "@/lib/title-paged";
import { storedKey, withSearch, type StoredQuery } from "@/lib/title-stored-query";
import { createLatestRequest } from "./latest-request";
import { DROPPED, done, isUnreachable, refusalOf } from "./provider-flow-support";
import { titlePorts, type TitleResult, type TitleStore } from "./title-list-flow";
import type { TitlesService } from "./titles";

export interface TitleStoredFlow {
  /** Reads the first page of the current query and drops the others (first show, Refresh, after a delete). */
  loadStored: () => Promise<TitleResult>;
  /** Reads the page that holds row `first` unless it is loaded or in flight; answers whether a read was requested. */
  needRange: (first: number, last: number) => boolean;
  /** A keystroke: the field's text is kept; nothing is read (the field's pause timer, in the shared library, calls `searchStored`). */
  typeStored: (text: string) => void;
  /** The pause after typing, Enter or the clear: the typed text becomes the search, from the top. */
  searchStored: () => Promise<TitleResult>;
  /** A filter or the sort changed: a new query, from the top. */
  changeStored: (change: (query: StoredQuery) => StoredQuery) => Promise<TitleResult>;
}

/** The Stored titles list's reads (`docs/41` sections 4.3, 5.2 and 6): `GET /api/titles/stored`, a page at a time by
 *  offset. Every read records the session's serial and the query's key before it awaits; an answer for another session
 *  or another query is dropped. A new query aborts the one in flight (`AbortController`), and an aborted read says
 *  nothing. A page that fails leaves the pages already held and says why. */
export function createTitleStoredFlow(deps: {
  readonly service: Pick<TitlesService, "listStored">;
  readonly store: () => TitleStore;
}): TitleStoredFlow {
  const { service, store } = deps;
  const ports = titlePorts(store);
  const stored = () => store().titlesStored;
  const latest = createLatestRequest();

  async function readPage(page: number, signal: AbortSignal): Promise<TitleResult> {
    const serial = store().serial;
    const query = stored().query;
    const key = storedKey(query);
    store().storedPageStart(page);
    try {
      const answer = await service.listStored(query, page * PAGE_SIZE, undefined, signal);
      if (signal.aborted || !store().signedIn || store().serial !== serial) return DROPPED;
      const rows = answer.items;
      store().storedPageLoaded(key, page, { rows, total: answer.total, version: answer.version, inventory: answer.inventory });
      if (answer.unreadable > 0 && storedKey(stored().query) === key) store().say(unreadableTitles(answer.unreadable), "warn", "Title");
      return done(undefined);
    } catch (error: unknown) {
      if (signal.aborted || !store().signedIn || store().serial !== serial) return DROPPED;
      store().storedPageFailed(key, page, isUnreachable(error));
      return refusalOf(ports, error);
    }
  }

  function loadStored(): Promise<TitleResult> {
    const signal = latest.next();
    store().storedStart();
    store().storedInvalidate();
    return readPage(0, signal);
  }

  function needRange(first: number): boolean {
    const { paged } = stored();
    const page = pageOf(first);
    if (paged.total === null || isLoaded(paged, page) || isLoading(paged, page)) return false;
    void readPage(page, latest.current());
    return true;
  }

  function changeStored(change: (query: StoredQuery) => StoredQuery): Promise<TitleResult> {
    const next = change(stored().query);
    if (storedKey(next) === storedKey(stored().query)) return Promise.resolve(done(undefined));
    const signal = latest.next();
    store().storedSetQuery(next);
    return readPage(0, signal);
  }

  return {
    loadStored,
    needRange,
    typeStored: (text) => store().storedType(text),
    searchStored: () => changeStored((query) => withSearch(query, stored().typed)),
    changeStored,
  };
}
