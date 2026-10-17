import { NavGroup } from "@giga/ui/lists/NavGroup";
import { NavItem } from "@giga/ui/lists/NavItem";
import type { SourceId, ViewCounts } from "@/lib/library-query";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { cn } from "@giga/ui/lib/cn";

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
        <NavItem key={view.id} selected={source === view.id}
          count={counts[view.id] ?? <span aria-hidden className={cn(SHIMMER, "h-[9px] w-6")} />}
          onClick={() => onSource(view.id)}>
          {view.label}
        </NavItem>
      ))}
    </NavGroup>
  );
}
