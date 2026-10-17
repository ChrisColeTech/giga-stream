import { useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { LiveChannelsPane } from "@/components/live/LiveChannelsPane";
import { LiveSettingsPane } from "@/components/live/LiveSettingsPane";
import { LiveStage } from "@/components/live/LiveStage";
import { CHANNEL_LIST } from "@/fixtures/channels";
import { filterChannels } from "@/lib/live-channels";
import { ALL_CATEGORY } from "@/lib/live-constants";
import { type PictureFit } from "@/lib/live-picture";
import { stageStateFor } from "@/lib/live-stage";
import { refreshChannels, retryStream } from "@/services/channels";
import type { ServiceResult } from "@/services/not-connected";
import { useAppStore } from "@/store/app-store";

/** Live: playback settings on the left, the video stage in the centre, channels on the right. Selection, the playing
 *  marker, the search, the category and the picture fit are local state over the fixture list. Refresh and Retry call
 *  the channel service; a refusal is reported once on the notice line. */
export function LivePage({ active }: { active: boolean }) {
  const channels = CHANNEL_LIST.items;
  const say = useAppStore((state) => state.say);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [selectedId, setSelectedId] = useState<string | null>(channels[0]?.id ?? null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [fit, setFit] = useState<PictureFit>("fit");

  const rows = filterChannels(channels, query, category);
  const selected = channels.find((channel) => channel.id === selectedId) ?? null;

  const report = (result: ServiceResult) => {
    if (!result.ok) say(result.message, "warn");
  };

  return (
    <WorkspaceSplit
      surface="live"
      active={active}
      left={<LiveSettingsPane fit={fit} onFitChange={setFit} />}
      center={
        <LiveStage
          state={stageStateFor(channels.length)}
          fit={fit}
          onRetry={() => report(retryStream())}
          onRefresh={() => report(refreshChannels())}
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
          }}
          onRefresh={() => report(refreshChannels())}
        />
      }
    />
  );
}
