import { useEffect, useRef } from "react";
import { openingChannel } from "@/lib/live-channels";
import { ChannelSearchSession, LastChannelSession, refreshFilteredChannels } from "@/services/channels";
import { requestLiveStream } from "@/services/live-stream-session";
import { useAppStore } from "@/store/app-store";

export interface LiveActions {
  readonly refresh: () => void;
  readonly retry: () => void;
  readonly changeQuery: (query: string) => void;
  readonly changeCategory: (category: string) => void;
  readonly select: (channelId: string) => void;
  readonly activate: (channelId: string) => void;
}

const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

/** Owns Live's reads and their cancellation. The store remains I/O-free and a refused read leaves its last list intact. */
export function useLiveActions(active: boolean): LiveActions {
  const refreshRequest = useRef<AbortController | null>(null);
  const search = useRef<ChannelSearchSession | null>(null);
  const lastChannel = useRef<LastChannelSession | null>(null);
  const initialized = useRef(false);
  const wasActive = useRef(active);
  const hydrationApplied = useAppStore((state) => state.hydrationApplied);
  const channels = useAppStore((state) => state.channels);
  const lastChannelId = useAppStore((state) => state.lastChannelId);
  const liveOnOpen = useAppStore((state) => state.playback.liveOnOpen);

  if (search.current === null) {
    search.current = new ChannelSearchSession(
      (answer) => {
        const store = useAppStore.getState();
        store.setChannels(answer);
        store.setChannelsLoading(false);
      },
      (error) => {
        const store = useAppStore.getState();
        store.setChannelsLoading(false);
        store.say(error instanceof Error ? error.message : "Channels could not be read.", "warn");
      },
    );
  }
  if (lastChannel.current === null) {
    lastChannel.current = new LastChannelSession((error) => {
      useAppStore.getState().say(
        error instanceof Error ? error.message : "The last channel could not be remembered.",
        "warn",
      );
    });
  }

  const read = (query: string, category: string, debounce: boolean) => {
    refreshRequest.current?.abort();
    refreshRequest.current = null;
    useAppStore.getState().setChannelsLoading(true);
    const request = { query, category };
    if (debounce) search.current?.search(request);
    else search.current?.readNow(request);
  };

  useEffect(() => {
    if (!hydrationApplied || initialized.current) return;
    initialized.current = true;
    const opening = openingChannel(channels, lastChannelId, liveOnOpen);
    const selected = opening.selected;
    useAppStore.getState().selectChannel(selected?.id ?? null);
    if (opening.playing !== null) {
      useAppStore.getState().playChannel(opening.playing.id, opening.playing.streamUrl, false);
    }
  }, [channels, hydrationApplied, lastChannelId, liveOnOpen]);

  useEffect(() => {
    if (active && !wasActive.current) {
      const state = useAppStore.getState();
      read(state.channelQuery, state.channelCategory, false);
    }
    wasActive.current = active;
  }, [active, hydrationApplied]);

  useEffect(() => () => {
    search.current?.cancel();
    lastChannel.current?.cancel();
    refreshRequest.current?.abort();
  }, []);

  return {
    refresh: () => {
      search.current?.cancel();
      refreshRequest.current?.abort();
      const controller = new AbortController();
      refreshRequest.current = controller;
      useAppStore.getState().setChannelsLoading(true);
      const state = useAppStore.getState();
      void refreshFilteredChannels(
        { query: state.channelQuery, category: state.channelCategory },
        controller.signal,
      )
        .then((answer) => {
          if (refreshRequest.current !== controller) return;
          const store = useAppStore.getState();
          store.setChannels(answer);
          store.say("Channels refreshed.");
        })
        .catch((error: unknown) => {
          if (!aborted(error)) useAppStore.getState().say(error instanceof Error ? error.message : "Channels could not be refreshed.", "warn");
        })
        .finally(() => {
          if (refreshRequest.current === controller) {
            refreshRequest.current = null;
            useAppStore.getState().setChannelsLoading(false);
          }
        });
    },
    retry: () => {
      const store = useAppStore.getState();
      if (store.playingChannelId && store.playingStreamUrl) {
        const url = store.playingStreamUrl;
        store.playChannel(store.playingChannelId, store.playingStreamUrl, true);
        const state = useAppStore.getState();
        requestLiveStream({
          url,
          autoplay: state.playback.autoplay,
          userInitiated: true,
        }, state.livePlaySerial);
      }
    },
    changeQuery: (query) => {
      const store = useAppStore.getState();
      store.setChannelQuery(query);
      read(query, store.channelCategory, true);
    },
    changeCategory: (category) => {
      const store = useAppStore.getState();
      store.setChannelCategory(category);
      read(store.channelQuery, category, false);
    },
    select: (channelId) => useAppStore.getState().selectChannel(channelId),
    activate: (channelId) => {
      const store = useAppStore.getState();
      const channel = store.channels?.items.find((item) => item.id === channelId);
      if (channel === undefined) return;
      store.selectChannel(channelId);
      store.playChannel(channel.id, channel.streamUrl, true);
      const state = useAppStore.getState();
      requestLiveStream({
        url: channel.streamUrl,
        autoplay: state.playback.autoplay,
        userInitiated: true,
      }, state.livePlaySerial);
      lastChannel.current?.remember(channelId);
    },
  };
}
