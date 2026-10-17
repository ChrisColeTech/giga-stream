import { History, LayoutGrid, Star } from "lucide-react";
import { RailRow } from "@/components/ui/RailRow";
import { RailSection } from "@/components/ui/RailSection";
import type { SourceId, ViewCounts } from "@/lib/library-query";

const VIEWS = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "history", label: "History", icon: History },
  { id: "favorites", label: "Favorites", icon: Star },
] as const;

export interface ViewsSectionProps {
  readonly source: SourceId;
  readonly counts: ViewCounts;
  readonly onSource: (source: SourceId) => void;
}

/** The Views group of the rail: All, History and Favorites, each with its count. */
export function ViewsSection({ source, counts, onSource }: ViewsSectionProps) {
  return (
    <RailSection id="library.views" title="Views">
      {VIEWS.map((view) => (
        <RailRow
          key={view.id}
          label={view.label}
          icon={view.icon}
          count={counts[view.id]}
          selected={source === view.id}
          onSelect={() => onSource(view.id)}
        />
      ))}
    </RailSection>
  );
}
