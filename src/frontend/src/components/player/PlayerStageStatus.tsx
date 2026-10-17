import { CircleOff, Library } from "lucide-react";
import { LiveNote } from "@/components/live/LiveNote";
import { PLAYER_IDLE_REASON } from "@/lib/player-copy";

export interface PlayerStageStatusProps {
  readonly kind: "idle" | "no-source";
  readonly reason?: string;
  readonly onAction: () => void;
}

/** The family stage note for settled states that have no media host. */
export function PlayerStageStatus({ kind, reason, onAction }: PlayerStageStatusProps) {
  const idle = kind === "idle";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <LiveNote
        icon={idle ? Library : CircleOff}
        title={idle ? "Nothing is open" : "No playable source"}
        sentence={idle ? PLAYER_IDLE_REASON : (reason ?? "This item has no playable source.")}
        action={idle ? "Open Library" : "Retry"}
        onAction={onAction}
      />
    </div>
  );
}
