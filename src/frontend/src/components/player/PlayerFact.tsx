import { PlayerRow } from "@/components/player/PlayerRow";

export interface PlayerFactProps {
  readonly label: string;
  readonly value: string;
}

/** A read-only fact: a 12 px label and a mono 11 px value, with no control (`21` section 8a). */
export function PlayerFact({ label, value }: PlayerFactProps) {
  return (
    <PlayerRow label={label}>
      <span className="min-w-0 truncate font-mono text-[11px] text-muted tabular-nums">{value}</span>
    </PlayerRow>
  );
}
