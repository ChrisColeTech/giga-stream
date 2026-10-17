import { Select } from "@giga/ui/controls/Select";
import { hasSourceChoice, type PlayerSource } from "@/lib/player-sources";

export interface PlayerSourceControlProps {
  readonly sources: readonly PlayerSource[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

/** Session-only source choice. It is absent when there is nothing to choose. */
export function PlayerSourceControl({ sources, activeId, onSelect }: PlayerSourceControlProps) {
  if (!hasSourceChoice(sources)) return null;
  return (
    <label className="flex min-w-0 flex-col gap-1.5 font-sans text-xs text-muted">
      <span>Source</span>
      <Select className="w-full" aria-label="Source" value={activeId} onChange={(event) => onSelect(event.target.value)}>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
      </Select>
    </label>
  );
}
