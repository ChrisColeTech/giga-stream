import { NavItem } from "@giga/ui/lists/NavItem";
import { Section } from "@giga/ui/lists/Section";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { cn } from "@giga/ui/lib/cn";
import type { LibraryQuery, ViewCounts } from "@/lib/library-query";
import { useAppStore } from "@/store/app-store";
import { LIBRARY_SECTION_KEYS, librarySectionState } from "./library-section-state";

export interface CategoriesSectionProps {
  readonly query: LibraryQuery;
  readonly signedIn: boolean;
  readonly genres: readonly string[];
  readonly counts: ViewCounts;
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
}

const pendingCount = <span aria-hidden className={cn(SHIMMER, "h-[9px] w-6")} />;
type Category = "all" | "history" | { readonly genre: string };

export function categoryQuery(category: Category): Partial<LibraryQuery> {
  if (category === "all") return { source: "all", genres: [] };
  if (category === "history") return { source: "history" };
  return { source: "all", genres: [category.genre] };
}

export function categorySelected(query: LibraryQuery, category: Category): boolean {
  if (category === "all") return query.source === "all" && query.genres.length === 0;
  if (category === "history") return query.source === "history";
  return query.source === "all" && query.genres.length === 1 && query.genres[0] === category.genre;
}

/** The Categories rail group: All, signed-in History, then the current answer's genre facets. */
export function CategoriesSection({ query, signedIn, genres, counts, onQuery }: CategoriesSectionProps) {
  const folded = useAppStore((state) => state.folded);
  const toggleFold = useAppStore((state) => state.toggleFold);
  const section = librarySectionState(folded, LIBRARY_SECTION_KEYS.categories, toggleFold);
  return (
    <Section title="Categories" {...section}>
      <NavItem selected={categorySelected(query, "all")} count={counts.all ?? pendingCount}
        onClick={() => onQuery(categoryQuery("all"))}>
        All
      </NavItem>
      {signedIn && (
        <NavItem selected={categorySelected(query, "history")} count={counts.history ?? pendingCount}
          onClick={() => onQuery(categoryQuery("history"))}>
          History
        </NavItem>
      )}
      {genres.map((genre) => (
        <NavItem key={genre} selected={categorySelected(query, { genre })}
          onClick={() => onQuery(categoryQuery({ genre }))}>
          {genre}
        </NavItem>
      ))}
    </Section>
  );
}
