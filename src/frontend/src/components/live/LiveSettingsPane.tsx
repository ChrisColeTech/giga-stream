import type { PictureFit } from "@/lib/live-picture";
import { PlaybackPane } from "./PlaybackPane";

export interface LiveSettingsPaneProps {
  readonly fit: PictureFit;
  readonly onFitChange: (fit: PictureFit) => void;
}

/** The left pane: the playback settings, in one scroll container. */
export function LiveSettingsPane({ fit, onFitChange }: LiveSettingsPaneProps) {
  return (
    <div className="flex size-full min-h-0 flex-1 flex-col">
      <PlaybackPane fit={fit} onFitChange={onFitChange} />
    </div>
  );
}
