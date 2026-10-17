import { NavGroup, NavItem } from "@/components/ui/NavRail";
import type { SourceId, ViewCounts } from "@/lib/library-query";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "history", label: "History" },
  { id: "favorites", label: "Favorites" },
] as const;

export interface ViewsSectionProps {
  readonly source: SourceId;
  readonly counts: ViewCounts;
  readonly onSource: (source: SourceId) => void;
}

/** The Views group of the rail: All, History and Favorites, each with its count. */
export function ViewsSection({ source, counts, onSource }: ViewsSectionProps) {
  return (
    <NavGroup heading="Views">
      {VIEWS.map((view) => (
        <NavItem key={view.id} selected={source === view.id} count={counts[view.id]} onClick={() => onSource(view.id)}>
          {view.label}
        </NavItem>
      ))}
    </NavGroup>
  );
}
