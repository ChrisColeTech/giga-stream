import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { LiveChannelsPane } from "@/components/live/LiveChannelsPane";
import { LiveSettingsPane } from "@/components/live/LiveSettingsPane";
import { LiveStage } from "@/components/live/LiveStage";
import { useLiveActions } from "@/hooks/useLiveActions";
import { EMPTY_CHANNEL_LIST } from "@/lib/live-channels";
import type { LiveStageState } from "@/lib/live-stage";
import { useAppStore } from "@/store/app-store";

/** Live: playback settings on the left, the video stage in the centre, and the fileserver's channels on the right. */
export function LivePage({ active }: { active: boolean }) {
  const actions = useLiveActions(active);
  const list = useAppStore((state) => state.channels) ?? EMPTY_CHANNEL_LIST;
  const hasList = useAppStore((state) => state.channels) !== null;
  const loading = useAppStore((state) => state.channelsLoading);
  const query = useAppStore((state) => state.channelQuery);
  const category = useAppStore((state) => state.channelCategory);
  const selectedId = useAppStore((state) => state.selectedChannelId);
  const playingId = useAppStore((state) => state.playingChannelId);
  const playingUrl = useAppStore((state) => state.playingStreamUrl);
  const streamState = useAppStore((state) => state.liveStage);
  const streamError = useAppStore((state) => state.liveStreamError);
  const fit = useAppStore((state) => state.playback.pictureFit);

  const selected = list.items.find((channel) => channel.id === selectedId) ?? null;
  const publishedCount = list.categories.reduce((sum, item) => sum + item.count, 0);
  const stageState: LiveStageState = streamState === "failed"
    ? "failed"
    : hasList && publishedCount === 0 && playingUrl === null
      ? "no-channels"
      : streamState;

  return (
    <WorkspaceSplit
      surface="live"
      active={active}
      left={<LiveSettingsPane />}
      center={
        <LiveStage
          state={stageState}
          fit={fit}
          error={streamError ?? undefined}
          onRetry={actions.retry}
          onRefresh={actions.refresh}
        />
      }
      right={
        <LiveChannelsPane
          list={list}
          rows={list.items}
          loading={loading && !hasList}
          query={query}
          category={category}
          selected={selected}
          playingId={playingId}
          onQueryChange={actions.changeQuery}
          onCategoryChange={actions.changeCategory}
          onSelect={actions.select}
          onActivate={actions.activate}
          onRefresh={actions.refresh}
        />
      }
    />
  );
}
