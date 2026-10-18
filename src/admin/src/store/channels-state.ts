import { DEFAULT_CHANNEL_QUERY, type ChannelQuery } from "@/lib/channel-query";
import type { Pages } from "@/lib/channel-pages";
import type { AdminChannel } from "@/types/admin-channel";

/* The Channels tab's data (`36` section 4, `41` section 4.3): facts only, no promise, no timer. */

export type ChannelsStatus = "idle" | "loading" | "ready" | "failed";

export interface ChannelPreview {
  readonly channelId: string;
  /** Raised by every request: the open and each step of the walk. A new serial detaches the player and attaches again. */
  readonly serial: number;
  /** The serial of the open itself: a step keeps it, so the window stays mounted at its place and size. */
  readonly opened: number;
  /** The channel's place among the rows the list shows (0-based), or null when the list does not hold it. */
  readonly at: number | null;
  /** The row as the list held it when Preview was pressed: the window's own read drops the list's pages, and a long
   *  list reads only the rows it shows, so the window may have no other copy until the pages come back. */
  readonly channel: AdminChannel | null;
}

export interface ChannelsState {
  readonly status: ChannelsStatus;
  /** What the list shows: search, filters, sort. A change drops every page and reads the first. */
  readonly query: ChannelQuery;
  /** Rows matching the query, from the last page read; null until one. */
  readonly total: number | null;
  /** The loaded pages by index (at most `MAX_PAGES_KEPT`), and the revision they were read at (null before any). */
  readonly pages: Pages<AdminChannel>;
  readonly pagesVersion: number | null;
  /** The loaded rows flattened, in list order: a derived read of `pages`, kept so a selector never builds it. */
  readonly items: readonly AdminChannel[];
  /** The ticked rows, whole, by id: a tick outlives its page being evicted or re-read, and a bulk run needs the row. */
  readonly held: Readonly<Record<string, AdminChannel>>;
  /** The row a workspace was opened from, so the workspace never depends on its page staying loaded. */
  readonly opened: AdminChannel | null;
  /** Every live channel (a handful), read apart from the list: the statusbar's `N preparing`. */
  readonly live: readonly AdminChannel[];
  /** The backend's revision in the last read; 0 before one. */
  readonly revision: number;
  readonly unreachable: boolean;
  readonly ticked: readonly string[];
  /** `Select all M matching` is reading the matching rows. */
  readonly resolving: boolean;
  readonly preview: ChannelPreview | null;
}

export const NO_CHANNELS: ChannelsState = {
  status: "idle",
  query: DEFAULT_CHANNEL_QUERY,
  total: null,
  pages: {},
  pagesVersion: null,
  items: [],
  held: {},
  opened: null,
  live: [],
  revision: 0,
  unreachable: false,
  ticked: [],
  resolving: false,
  preview: null,
};
