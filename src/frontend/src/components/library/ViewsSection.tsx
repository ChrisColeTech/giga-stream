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
  /** Signed out, History is not a view at all (`63` section 3.4): the row is unrendered, its query unissued. */
  readonly signedIn: boolean;
  readonly counts: ViewCounts;
  readonly onSource: (source: SourceId) => void;
}

/** The Views group of the rail: All, History and Favorites, each with its count - History only while a session is
 *  held. */
export function ViewsSection({ source, signedIn, counts, onSource }: ViewsSectionProps) {
  const views = VIEWS.filter((view) => signedIn || view.id !== "history");
  return (
    <NavGroup heading="Views">
      {views.map((view) => (
        <NavItem key={view.id} selected={source === view.id}
          count={counts[view.id] ?? <span aria-hidden className={cn(SHIMMER, "h-[9px] w-6")} />}
          onClick={() => onSource(view.id)}>
          {view.label}
        </NavItem>
      ))}
    </NavGroup>
  );
}
