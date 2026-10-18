import type { ChannelListAnswer } from "@/services/schemas/channel-schema";
import type { StateSnapshot } from "@/services/state";
import type { StreamFacts, StreamStageState } from "@/types/stream-player";

export interface LiveSlice {
  channels: ChannelListAnswer | null;
  channelsLoading: boolean;
  channelsResolved: boolean;
  backend: StateSnapshot["backend"];
  lastChannelId: string | null;
  channelQuery: string;
  channelCategory: string;
  selectedChannelId: string | null;
  playingChannelId: string | null;
  playingStreamUrl: string | null;
  livePlaySerial: number;
  livePlayUserInitiated: boolean;
  liveStage: StreamStageState;
  liveStreamError: string | null;
  liveStreamFacts: StreamFacts;
  setChannels: (channels: ChannelListAnswer | null) => void;
  setChannelsLoading: (loading: boolean) => void;
  setChannelQuery: (query: string) => void;
  setChannelCategory: (category: string) => void;
  selectChannel: (id: string | null) => void;
  playChannel: (id: string, streamUrl: string, userInitiated: boolean) => void;
  /** Stop (`50` section 2.4): the whole live state returns to rest — the playing markers clear, the stage goes back
   *  to its idle note, and no stale failure sentence survives. `retry` reads the markers, so it answers nothing
   *  after a stop; playing the channel again sets everything through `playChannel`. */
  stopLive: () => void;
  setLiveStage: (stage: StreamStageState, reason?: string) => void;
  setLiveStreamFacts: (facts: StreamFacts) => void;
}

type Set = (partial: Partial<LiveSlice> | ((state: LiveSlice) => Partial<LiveSlice>)) => void;

export function liveSlice(set: Set): LiveSlice {
  return {
    channels: null,
    channelsLoading: false,
    channelsResolved: false,
    backend: undefined,
    lastChannelId: null,
    channelQuery: "",
    channelCategory: "all",
    selectedChannelId: null,
    playingChannelId: null,
    playingStreamUrl: null,
    livePlaySerial: 0,
    livePlayUserInitiated: false,
    liveStage: "idle",
    liveStreamError: null,
    liveStreamFacts: {},
    setChannels: (channels) => set((state) => ({
      channels,
      channelsResolved: channels !== null,
      selectedChannelId: channels?.items.some((item) => item.id === state.selectedChannelId)
        ? state.selectedChannelId
        : channels?.items[0]?.id ?? null,
    })),
    setChannelsLoading: (channelsLoading) => set({ channelsLoading }),
    setChannelQuery: (channelQuery) => set({ channelQuery }),
    setChannelCategory: (channelCategory) => set({ channelCategory }),
    selectChannel: (selectedChannelId) => set({ selectedChannelId }),
    playChannel: (playingChannelId, playingStreamUrl, livePlayUserInitiated) =>
      set((state) => ({
        playingChannelId,
        playingStreamUrl,
        livePlayUserInitiated,
        livePlaySerial: state.livePlaySerial + 1,
        liveStage: "loading",
        liveStreamError: null,
      })),
    stopLive: () => set({ playingChannelId: null, playingStreamUrl: null, liveStage: "idle", liveStreamError: null }),
    setLiveStage: (liveStage, reason) => set({ liveStage, liveStreamError: reason ?? null }),
    setLiveStreamFacts: (liveStreamFacts) => set({ liveStreamFacts }),
  };
}
