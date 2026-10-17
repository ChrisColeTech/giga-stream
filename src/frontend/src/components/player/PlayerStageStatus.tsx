import { CircleAlert, CircleOff, Library, ListVideo } from "lucide-react";
import { LiveNote } from "@/components/live/LiveNote";
import { PLAYER_IDLE_REASON } from "@/lib/player-copy";

export interface PlayerStageStatusProps {
  readonly kind: "idle" | "no-source" | "choose-episode" | "unavailable";
  readonly reason?: string;
  readonly onAction?: () => void;
}

/** The family stage note for settled states that have no media host. */
export function PlayerStageStatus({ kind, reason, onAction }: PlayerStageStatusProps) {
  const idle = kind === "idle";
  const choosing = kind === "choose-episode";
  const unavailable = kind === "unavailable";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <LiveNote
        icon={idle ? Library : choosing ? ListVideo : unavailable ? CircleAlert : CircleOff}
        title={idle ? "Nothing is open" : choosing ? "Choose an episode"
          : unavailable ? "Playback unavailable" : "No playable source"}
        sentence={idle ? PLAYER_IDLE_REASON : choosing
          ? "Choose an episode from the browser to begin."
          : unavailable ? "Playback information could not be read."
          : (reason ?? "This item has no playable source.")}
        action={choosing ? undefined : idle ? "Open Library" : "Retry"}
        onAction={onAction}
      />
    </div>
  );
}
