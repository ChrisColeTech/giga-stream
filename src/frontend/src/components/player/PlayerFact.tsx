import { PlayerRow } from "@/components/player/PlayerRow";

export interface PlayerFactProps {
  readonly label: string;
  readonly value: string;
}

/** A read-only fact: a mono label and a mono value, with no control (`21` section 3.4a). */
export function PlayerFact({ label, value }: PlayerFactProps) {
  return (
    <PlayerRow label={label}>
      <span className="min-w-0 truncate font-mono text-[11px] text-muted tabular-nums">{value}</span>
    </PlayerRow>
  );
}
