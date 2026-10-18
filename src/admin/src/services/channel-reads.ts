import { WINDOW_MIN_ROWS } from "@giga/ui/lib/window-constants";
import { selectionCapped, unreadableChannels } from "@/constants/channel-copy";
import { queryKey, type ChannelQuery } from "@/lib/channel-query";
import type { AdminChannel } from "@/types/admin-channel";
import {
  DROPPED,
  codeOf,
  done,
  refusal,
  stillSession,
  type ChannelFlowDeps,
  type FlowResult,
} from "./channel-flow-support";

/** Most rows `Select all M matching` ticks: 50 reads of 200. A larger match ticks the first of them and says so. */
export const SELECT_MATCHING_MAX = 10_000;
const READ_SIZE = 200;

export interface ChannelReads {
  /** The first read, when the tab is first shown. Does nothing while a read is already running. */
  load: () => Promise<FlowResult>;
  /** `Refresh`: every loaded page is dropped and the window reads what it shows again; the scroll position stays. */
  refresh: () => Promise<FlowResult>;
  /** One page of the list by the held query (what the window asks for). */
  readPage: (index: number) => Promise<FlowResult>;
  /** A new query: the pages are dropped and the first is read. */
  setQuery: (query: ChannelQuery) => Promise<FlowResult>;
  /** `Select all M matching`: reads every matching row (at most `SELECT_MATCHING_MAX`) and ticks them. */
  selectMatching: () => Promise<FlowResult>;
}

/** The Channels list's reads (`41` section 4.3). Each records the session's serial and the query's key before it awaits
 *  and writes only if both are unchanged after: an answer for an older query or a finished session is thrown away. */
export function createChannelReads({ service, store }: ChannelFlowDeps): ChannelReads {
  async function readPage(index: number): Promise<FlowResult> {
    const serial = store().serial;
    const query = store().channels.query;
    const key = queryKey(query);
    try {
      const page = await service.page(query, index);
      if (!stillSession(store, serial)) return DROPPED;
      if (queryKey(store().channels.query) !== key) return done(undefined);
      store().channelsPageLoaded(key, index, page.items, page.total, page.revision);
      if (page.unreadable > 0) store().say(unreadableChannels(page.unreadable), "warn", "Channel");
      return done(undefined);
    } catch (error: unknown) {
      if (!stillSession(store, serial)) return DROPPED;
      store().channelsLoadFailed(codeOf(error) === "backend.unreachable");
      return refusal(store(), error);
    }
  }

  /** The live rows, for the statusbar. A failed read changes nothing and says nothing: the list's own read speaks. */
  async function readLive(): Promise<void> {
    const serial = store().serial;
    const page = await service.liveRows().catch(() => null);
    if (page !== null && stillSession(store, serial)) store().channelsLiveLoaded(page.items);
  }

  async function first(): Promise<FlowResult> {
    store().channelsStartLoad();
    const [result] = await Promise.all([readPage(0), readLive()]);
    return result;
  }

  const load = async (): Promise<FlowResult> => (store().channels.status === "loading" ? done(undefined) : first());

  async function refresh(): Promise<FlowResult> {
    store().jobEventsReopen();
    const total = store().channels.total;
    store().channelsInvalidate();
    if (total !== null && total > WINDOW_MIN_ROWS) {
      await readLive();
      return done(undefined);
    }
    return first();
  }

  async function setQuery(query: ChannelQuery): Promise<FlowResult> {
    if (queryKey(query) === queryKey(store().channels.query)) return done(undefined);
    store().channelsSetQuery(query);
    const [result] = await Promise.all([readPage(0), readLive()]);
    return result;
  }

  async function selectMatching(): Promise<FlowResult> {
    const serial = store().serial;
    const query = store().channels.query;
    const key = queryKey(query);
    const wanted = Math.min(store().channels.total ?? 0, SELECT_MATCHING_MAX);
    const rows: AdminChannel[] = [];
    store().channelsResolving(true);
    try {
      for (let page = 0; page * READ_SIZE < wanted; page += 1) {
        const answer = await service.page(query, page, READ_SIZE);
        if (!stillSession(store, serial)) return DROPPED;
        if (queryKey(store().channels.query) !== key) return done(undefined);
        rows.push(...answer.items);
      }
      store().channelsTickRows(rows);
      const total = store().channels.total ?? 0;
      if (total > SELECT_MATCHING_MAX) store().say(selectionCapped(SELECT_MATCHING_MAX, total), "info", "Channel");
      return done(undefined);
    } catch (error: unknown) {
      return stillSession(store, serial) ? refusal(store(), error) : DROPPED;
    } finally {
      if (stillSession(store, serial)) store().channelsResolving(false);
    }
  }

  return { load, refresh, readPage, setQuery, selectMatching };
}
