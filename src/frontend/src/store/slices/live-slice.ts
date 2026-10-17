import type { ChannelListAnswer } from "@/services/schemas/channel-schema";
import type { StateSnapshot } from "@/services/state";

export type LiveStageState = "idle" | "loading" | "ready" | "failed";

export interface LiveSlice {
  channels: ChannelListAnswer | null;
  backend: StateSnapshot["backend"];
  lastChannelId: string | null;
  channelQuery: string;
  channelCategory: string;
  selectedChannelId: string | null;
  playingChannelId: string | null;
  liveStage: LiveStageState;
  setChannels: (channels: ChannelListAnswer | null) => void;
  setChannelQuery: (query: string) => void;
  setChannelCategory: (category: string) => void;
  selectChannel: (id: string | null) => void;
  playChannel: (id: string | null) => void;
  setLiveStage: (stage: LiveStageState) => void;
}

type Set = (partial: Partial<LiveSlice>) => void;

export function liveSlice(set: Set): LiveSlice {
  return {
    channels: null,
    backend: undefined,
    lastChannelId: null,
    channelQuery: "",
    channelCategory: "all",
    selectedChannelId: null,
    playingChannelId: null,
    liveStage: "idle",
    setChannels: (channels) => set({ channels }),
    setChannelQuery: (channelQuery) => set({ channelQuery }),
    setChannelCategory: (channelCategory) => set({ channelCategory }),
    selectChannel: (selectedChannelId) => set({ selectedChannelId }),
    playChannel: (playingChannelId) => set({ playingChannelId }),
    setLiveStage: (liveStage) => set({ liveStage }),
  };
}
