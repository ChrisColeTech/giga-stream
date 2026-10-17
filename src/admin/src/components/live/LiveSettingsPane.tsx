import { PlaybackPane } from "./PlaybackPane";

/** The left pane: the playback settings, in one scroll container. */
export function LiveSettingsPane() {
  return (
    <div className="flex size-full min-h-0 flex-1 flex-col">
      <PlaybackPane />
    </div>
  );
}
