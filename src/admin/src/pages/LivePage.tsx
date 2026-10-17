import { useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { LiveChannelsPane } from "@/components/live/LiveChannelsPane";
import { LiveSettingsPane } from "@/components/live/LiveSettingsPane";
import { LiveStage } from "@/components/live/LiveStage";
import { CHANNEL_LIST, LAST_CHANNEL_ID } from "@/fixtures/channels";
import { useLiveActions } from "@/hooks/useLiveActions";
import { filterChannels } from "@/lib/live-channels";
import { ALL_CATEGORY } from "@/lib/live-constants";
import { stageStateFor } from "@/lib/live-stage";
import { useAppStore } from "@/store/app-store";

/** Live: playback settings on the left, the video stage in the centre, channels on the right. The page composes the
 *  panes and keeps the local selection, playing marker, search and category; the picture fit is a playback preference
 *  in the store. Its calls live in the hook. */
export function LivePage({ active }: { active: boolean }) {
  const channels = CHANNEL_LIST.items;
  const actions = useLiveActions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  /* The Live opens setting: "Last channel" opens on the channel last played, already playing; "Nothing" selects the
     first row and plays nothing. Read as the page first renders. */
  const [playingId, setPlayingId] = useState<string | null>(() =>
    useAppStore.getState().playback.liveOnOpen === "last" ? LAST_CHANNEL_ID : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => playingId ?? channels[0]?.id ?? null);
  const fit = useAppStore((state) => state.playback.pictureFit);

  const rows = filterChannels(channels, query, category);
  const selected = channels.find((channel) => channel.id === selectedId) ?? null;

  return (
    <WorkspaceSplit
      surface="live"
      active={active}
      left={<LiveSettingsPane />}
      center={
        <LiveStage
          state={stageStateFor(channels.length)}
          fit={fit}
          onRetry={actions.retry}
          onRefresh={actions.refresh}
        />
      }
      right={
        <LiveChannelsPane
          list={CHANNEL_LIST}
          rows={rows}
          loading={false}
          query={query}
          category={category}
          selected={selected}
          playingId={playingId}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          onSelect={setSelectedId}
          onActivate={(id) => {
            setSelectedId(id);
            setPlayingId(id);
            actions.remember(id);
          }}
          onRefresh={actions.refresh}
        />
      }
    />
  );
}
