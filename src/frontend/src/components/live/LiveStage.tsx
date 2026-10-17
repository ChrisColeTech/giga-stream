import type { PictureFit } from "@/lib/live-picture";
import type { LiveStageState } from "@/lib/live-stage";
import { LivePlayer } from "./LivePlayer";
import { NoChannelsNote } from "./NoChannelsNote";
import { StreamNote } from "./StreamNote";

export interface LiveStageProps {
  readonly state: LiveStageState;
  readonly fit: PictureFit;
  readonly error?: string;
  readonly onRetry: () => void;
  readonly onRefresh: () => void;
}

/** The centre stage: the player fills it, and a note sits over the picture only in its own state. The note band stops
 *  above the player's control bar so the controls stay clear. */
export function LiveStage({ state, fit, error, onRetry, onRefresh }: LiveStageProps) {
  return (
    <div className="relative flex size-full min-h-0 min-w-0 flex-1 flex-col">
      <LivePlayer fit={fit} />
      {(state === "failed" || state === "no-channels") && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-12 flex items-center justify-center p-4">
          {state === "failed" ? <StreamNote reason={error} onRetry={onRetry} /> : <NoChannelsNote onRefresh={onRefresh} />}
        </div>
      )}
    </div>
  );
}
