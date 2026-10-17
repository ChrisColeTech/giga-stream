import { PlayerRow } from "@/components/player/PlayerRow";

export interface PlayerFactProps {
  readonly label: string;
  readonly value: string;
}

/** A read-only fact: the rail label and a mono value, with no control. */
export function PlayerFact({ label, value }: PlayerFactProps) {
  return (
    <PlayerRow label={label}>
      <span className="min-w-0 truncate font-mono text-xs text-muted tabular-nums">{value}</span>
    </PlayerRow>
  );
}
