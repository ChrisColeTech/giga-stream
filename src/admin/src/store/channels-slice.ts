import { pruneTicks, upsertChannel, withoutChannel } from "@/lib/channel-list";
import type { AdminChannel } from "@/types/admin-channel";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The Channels tab's data, a slice of the one store (`36` section 4). Facts only: no promise, no timer. The flows
 * (`services/channel-flows.ts`) read the backend and hand the answers to these setters. `unreachable` is set by a transport
 * failure and cleared by the next successful read; while it is set every write is disabled with the unreachable sentence.
 * `preview` is the request value of the Preview window (`01` section 6): the channel it plays and a serial raised at
 * every open, so each open reads afresh. */

export type ChannelsStatus = "idle" | "loading" | "ready" | "failed";

export interface ChannelPreview {
  readonly channelId: string;
  readonly serial: number;
}

export interface ChannelsState {
  readonly status: ChannelsStatus;
  readonly items: readonly AdminChannel[];
  /** The backend's revision in the last list read; 0 before one. */
  readonly revision: number;
  readonly unreachable: boolean;
  readonly ticked: readonly string[];
  readonly preview: ChannelPreview | null;
}

export const NO_CHANNELS: ChannelsState = {
  status: "idle",
  items: [],
  revision: 0,
  unreachable: false,
  ticked: [],
  preview: null,
};

export interface ChannelsSlice {
  channels: ChannelsState;
  channelsStartLoad: () => void;
  /** A list read answered: it replaces the items, clears `unreachable` and drops the ticks of rows that are gone. */
  channelsLoaded: (items: readonly AdminChannel[], revision: number) => void;
  /** A list read failed: the last items stay. */
  channelsLoadFailed: (unreachable: boolean) => void;
  /** A write's answer replaces the channel with its id (or adds a new one). */
  channelUpsert: (channel: AdminChannel) => void;
  channelRemove: (id: string) => void;
  channelTick: (id: string, on: boolean) => void;
  channelsTickAll: (on: boolean) => void;
  /** Leaves exactly these ids ticked (a bulk run unticks the rows it finished). */
  channelsSetTicked: (ids: readonly string[]) => void;
  channelsMarkUnreachable: (unreachable: boolean) => void;
  /** `Preview →`: the window's request value, its serial raised. The caller opens the overlay. */
  channelsOpenPreview: (channelId: string) => void;
  channelsClosePreview: () => void;
  /** Back to the start: the page leaving with the session (sign-out, a session ending). */
  channelsReset: () => void;
}

export function createChannelsSlice(set: SliceSet<ChannelsSlice>, get: SliceGet<ChannelsSlice>): ChannelsSlice {
  const patch = (next: Partial<ChannelsState>): void => set({ channels: { ...get().channels, ...next } });
  const withItems = (items: readonly AdminChannel[]): Partial<ChannelsState> => ({
    items,
    ticked: pruneTicks(get().channels.ticked, items),
  });
  return {
    channels: NO_CHANNELS,
    channelsStartLoad: () => patch({ status: "loading" }),
    channelsLoaded: (items, revision) => patch({ status: "ready", unreachable: false, revision, ...withItems(items) }),
    channelsLoadFailed: (unreachable) => patch({ status: "failed", unreachable }),
    channelUpsert: (channel) => patch(withItems(upsertChannel(get().channels.items, channel))),
    channelRemove: (id) => patch(withItems(withoutChannel(get().channels.items, id))),
    channelTick: (id, on) => {
      const rest = get().channels.ticked.filter((one) => one !== id);
      patch({ ticked: on ? [...rest, id] : rest });
    },
    channelsTickAll: (on) => patch({ ticked: on ? get().channels.items.map((item) => item.id) : [] }),
    channelsSetTicked: (ids) => patch({ ticked: pruneTicks(ids, get().channels.items) }),
    channelsMarkUnreachable: (unreachable) => patch({ unreachable }),
    channelsOpenPreview: (channelId) => patch({ preview: { channelId, serial: (get().channels.preview?.serial ?? 0) + 1 } }),
    channelsClosePreview: () => patch({ preview: null }),
    channelsReset: () => set({ channels: NO_CHANNELS }),
  };
}
