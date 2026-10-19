import { X } from "lucide-react";
import { appliedFilters } from "@/lib/library-filter-state";
import type { LibraryQuery } from "@/lib/library-query";

export interface AppliedFiltersProps {
  readonly query: LibraryQuery;
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
}

/** Removable state tokens for the filters already applied, never offered-choice chips. */
export function AppliedFilters({ query, onQuery }: AppliedFiltersProps) {
  const filters = appliedFilters(query);
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-hair px-3 py-2" aria-label="Applied filters">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          aria-label={`Remove ${filter.label}`}
          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-accent-edge bg-accent-tint px-2.5 text-xs text-accent-text"
          onClick={() => onQuery(filter.remove)}
        >
          {filter.label}<X className="size-3" aria-hidden />
        </button>
      ))}
    </div>
  );
}
