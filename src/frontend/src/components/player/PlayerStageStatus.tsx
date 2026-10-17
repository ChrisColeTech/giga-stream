import { CircleAlert, CircleOff } from "lucide-react";
import { LiveNote } from "@/components/live/LiveNote";

export interface PlayerStageStatusProps {
  readonly kind: "no-source" | "unavailable";
  readonly reason?: string;
  readonly onAction?: () => void;
}

/** The family stage note for settled states that have no media host. */
export function PlayerStageStatus({ kind, reason, onAction }: PlayerStageStatusProps) {
  const unavailable = kind === "unavailable";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <LiveNote
        icon={unavailable ? CircleAlert : CircleOff}
        title={unavailable ? "Playback unavailable" : "No playable source"}
        sentence={unavailable ? "Playback information could not be read."
          : (reason ?? "This item has no playable source.")}
        action="Retry"
        onAction={onAction}
      />
    </div>
  );
}
