import { acceptPage, EMPTY_PAGES, loadedRows, patchRow, removeRow } from "@/lib/channel-pages";
import { queryKey, type ChannelQuery } from "@/lib/channel-query";
import { channelById } from "@/lib/channel-list";
import type { AdminChannel } from "@/types/admin-channel";
import { NO_CHANNELS, type ChannelsState } from "./channels-state";
import type { SliceGet, SliceSet } from "./slices/slice-host";

export { NO_CHANNELS, type ChannelPreview, type ChannelsState, type ChannelsStatus } from "./channels-state";

/* The Channels tab's slice of the one store (`36` section 4, `41` section 4.3). Facts only: no promise, no timer. The
 * flows (`services/channel-flows.ts`) read the backend and hand the answers to these setters. `unreachable` is set by a
 * transport failure and cleared by the next successful read; while it is set every write is disabled with the
 * unreachable sentence. `preview` is the request value of the Preview window (`01` section 6). */

export interface ChannelsSlice {
  channels: ChannelsState;
  channelsStartLoad: () => void;
  /** One page of the query `key` answered. An answer for another query is dropped; one read at another revision than
   *  the held pages drops them (the set changed under them). */
  channelsPageLoaded: (key: string, index: number, rows: readonly AdminChannel[], total: number, revision: number) => void;
  /** The live rows answered: the statusbar's count, and the rows held anywhere are brought up to date. */
  channelsLiveLoaded: (rows: readonly AdminChannel[]) => void;
  /** A list read failed: the pages and the total stay. */
  channelsLoadFailed: (unreachable: boolean) => void;
  /** A new query: every page dropped, the total forgotten; the ticks stay. */
  channelsSetQuery: (query: ChannelQuery) => void;
  /** Every page dropped (a position moved); the window reads what it shows again. The scroll position stays. */
  channelsInvalidate: () => void;
  /** A write's answer replaces the channel wherever it is held; an unknown one is a new row: the total moves by one. */
  channelUpsert: (channel: AdminChannel) => void;
  channelRemove: (id: string) => void;
  /** The row a workspace opens from. */
  channelRemember: (channel: AdminChannel) => void;
  channelTick: (id: string, on: boolean) => void;
  /** `All`: ticks every loaded row (the ticks held elsewhere stay); off clears every tick. */
  channelsTickAll: (on: boolean) => void;
  /** Ticks these whole rows (`Select all M matching`). */
  channelsTickRows: (rows: readonly AdminChannel[]) => void;
  /** Leaves exactly these ids ticked (a bulk run unticks the rows it finished). */
  channelsSetTicked: (ids: readonly string[]) => void;
  channelsResolving: (resolving: boolean) => void;
  channelsMarkUnreachable: (unreachable: boolean) => void;
  /** `Preview →`: the window's request value, its serial raised. The caller opens the overlay. */
  channelsOpenPreview: (channelId: string) => void;
  channelsClosePreview: () => void;
  /** Back to the start: the page leaving with the session (sign-out, a session ending). */
  channelsReset: () => void;
}

const idOf = (channel: AdminChannel): string => channel.id;
const byId = (rows: readonly AdminChannel[]): Record<string, AdminChannel> => Object.fromEntries(rows.map((row) => [row.id, row]));
const withRow = (rows: readonly AdminChannel[], row: AdminChannel): AdminChannel[] =>
  [...rows.filter((one) => one.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name));
const keepHeld =(held: ChannelsState["held"], ids: readonly string[]): ChannelsState["held"] =>
  Object.fromEntries(ids.flatMap((id) => (held[id] === undefined ? [] : [[id, held[id]]])));

export function createChannelsSlice(set: SliceSet<ChannelsSlice>, get: SliceGet<ChannelsSlice>): ChannelsSlice {
  const patch = (next: Partial<ChannelsState>): void => set({ channels: { ...get().channels, ...next } });
  const withPages = (pages: ChannelsState["pages"]): Partial<ChannelsState> => ({ pages, items: loadedRows(pages) });
  const known = (s: ChannelsState, id: string): boolean => channelById(s, id) !== undefined;

  return {
    channels: NO_CHANNELS,
    channelsStartLoad: () => patch({ status: "loading" }),
    channelsPageLoaded: (key, index, rows, total, revision) => {
      const s = get().channels;
      if (queryKey(s.query) !== key) return;
      const next = acceptPage({ pages: s.pages, version: s.pagesVersion }, index, rows, revision);
      const held = { ...s.held, ...byId(rows.filter((row) => s.held[row.id] !== undefined)) };
      patch({ status: "ready", unreachable: false, total, revision, pagesVersion: next.version, held, ...withPages(next.pages) });
    },
    channelsLiveLoaded: (rows) => {
      let pages = get().channels.pages;
      for (const row of rows) pages = patchRow(pages, row, idOf);
      const s = get().channels;
      const held = { ...s.held, ...byId(rows.filter((row) => s.held[row.id] !== undefined)) };
      const opened = rows.find((row) => row.id === s.opened?.id) ?? s.opened;
      patch({ live: rows, held, opened, ...withPages(pages) });
    },
    channelsLoadFailed: (unreachable) => patch({ status: "failed", unreachable }),
    channelsSetQuery: (query) =>
      patch({ query, status: "loading", total: null, pagesVersion: null, ...withPages(EMPTY_PAGES.pages) }),
    channelsInvalidate: () => patch({ pagesVersion: null, ...withPages(EMPTY_PAGES.pages) }),
    channelUpsert: (channel) => {
      const s = get().channels;
      const isNew = !known(s, channel.id);
      const inLive = s.live.some((row) => row.id === channel.id);
      const live = channel.kind === "live" && (isNew || inLive) ? withRow(s.live, channel) : s.live;
      const placed = isNew
        ? { total: (s.total ?? 0) + 1, pagesVersion: null, ...withPages(EMPTY_PAGES.pages) }
        : withPages(patchRow(s.pages, channel, idOf));
      patch({
        live,
        held: s.held[channel.id] === undefined ? s.held : { ...s.held, [channel.id]: channel },
        opened: s.opened?.id === channel.id ? channel : s.opened,
        ...placed,
      });
    },
    channelRemove: (id) => {
      const s = get().channels;
      const was = known(s, id);
      patch({
        ...withPages(removeRow(s.pages, id, idOf)),
        total: was && s.total !== null ? Math.max(0, s.total - 1) : s.total,
        live: s.live.filter((row) => row.id !== id),
        held: keepHeld(s.held, s.ticked.filter((one) => one !== id)),
        opened: s.opened?.id === id ? null : s.opened,
        ticked: s.ticked.filter((one) => one !== id),
      });
    },
    channelRemember: (channel) => patch({ opened: channel }),
    channelTick: (id, on) => {
      const s = get().channels;
      const ticked = s.ticked.filter((one) => one !== id);
      const row = channelById(s, id);
      patch(
        on
          ? { ticked: [...ticked, id], held: row === undefined ? s.held : { ...s.held, [id]: row } }
          : { ticked, held: keepHeld(s.held, ticked) },
      );
    },
    channelsTickAll: (on) => {
      const s = get().channels;
      if (!on) return patch({ ticked: [], held: {} });
      get().channelsTickRows(s.items);
    },
    channelsTickRows: (rows) => {
      const s = get().channels;
      const ticked = new Set(s.ticked);
      const fresh = rows.filter((row) => !ticked.has(row.id));
      patch({ ticked: [...s.ticked, ...fresh.map(idOf)], held: { ...s.held, ...byId(fresh) } });
    },
    channelsSetTicked: (ids) => patch({ ticked: ids, held: keepHeld(get().channels.held, ids) }),
    channelsResolving: (resolving) => patch({ resolving }),
    channelsMarkUnreachable: (unreachable) => patch({ unreachable }),
    channelsOpenPreview: (channelId) => patch({ preview: { channelId, serial: (get().channels.preview?.serial ?? 0) + 1 } }),
    channelsClosePreview: () => patch({ preview: null }),
    channelsReset: () => set({ channels: NO_CHANNELS }),
  };
}
