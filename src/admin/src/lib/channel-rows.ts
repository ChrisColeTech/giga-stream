import { DELETE_SYNCED_TIP, MODE_LABEL } from "@/constants/channel-copy";
import type { AdminChannel } from "@/types/admin-channel";
import { channelState, type RowState } from "./row-state";

/** One channel as the list draws it (`28` section 7.2, Channels index): every cell a string or the state word. Pure. */
export interface ChannelRowView {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  readonly category: string;
  /** `Live` or `Stream`. */
  readonly kind: string;
  readonly state: RowState;
  /** `Loop` or `Encode`; blank for a stream channel, which has no engine. */
  readonly mode: string;
  /** What is on air; blank when nothing is, and for a stream channel. */
  readonly nowPlaying: string;
  /** The tooltip of `Delete`: a synced row says what happens next; any other row has none. */
  readonly deleteTip: string | undefined;
}

/** Is this a stream row a playlist sync created? It carries the playlist host as its `source`. */
export const isSynced = (channel: AdminChannel): boolean => channel.kind === "stream" && channel.source !== undefined;

export function channelRow(channel: AdminChannel): ChannelRowView {
  const base = {
    id: channel.id,
    number: channel.number ?? "",
    name: channel.name,
    category: channel.category,
    deleteTip: isSynced(channel) ? DELETE_SYNCED_TIP : undefined,
  };
  if (channel.kind === "live") {
    return {
      ...base,
      kind: "Live",
      state: channelState({ enabled: channel.enabled, state: channel.state }),
      mode: MODE_LABEL[channel.mode],
      nowPlaying: channel.nowPlaying?.name ?? "",
    };
  }
  const edited = (channel.editedFields ?? []).length > 0;
  const origin = channel.source === undefined ? "manual" : edited ? "edited" : "synced";
  return { ...base, kind: "Stream", state: channelState({ enabled: channel.enabled, origin }), mode: "", nowPlaying: "" };
}

/** The rows in the order the list shows them: by number, then name. A channel with no number sorts last. */
export function channelRows(channels: readonly AdminChannel[]): readonly ChannelRowView[] {
  const order = (channel: AdminChannel): number => (channel.number === undefined ? Infinity : Number(channel.number));
  return [...channels]
    .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
    .map(channelRow);
}
