import { Select } from "@/components/ui/Field";
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
    <div className="absolute top-2 left-2 z-10 w-36 rounded-ctl bg-panel/90 p-1 shadow-raised">
      <Select aria-label="Source" value={activeId} onChange={(event) => onSelect(event.target.value)}>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
      </Select>
    </div>
  );
}
