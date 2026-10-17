import { useCallback, useMemo, useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { LibraryBody } from "@/components/library/LibraryBody";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { LibraryRail } from "@/components/library/LibraryRail";
import { useMarks } from "@/components/library/marks-store";
import { COLLECTION_ROWS } from "@/fixtures/collections";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import { resolveItems } from "@/lib/library-marks";
import {
  DEFAULT_QUERY,
  genreChoices,
  viewCounts,
  visibleItems,
  yearChoices,
  type LibraryQuery,
  type ListView,
  type Scope,
  type SourceId,
} from "@/lib/library-query";

const GENRES = genreChoices(LIBRARY_ITEMS);
const YEARS = yearChoices(LIBRARY_ITEMS);

/** Library: collections on the left, the media body in the centre, filters on the right. The query, the view and the
 *  selection are local to the surface; the marks come from the shared marks store. */
export function LibraryPage({ active }: { active: boolean }) {
  const [query, setQuery] = useState<LibraryQuery>(DEFAULT_QUERY);
  const [view, setView] = useState<ListView>("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const marks = useMarks();
  const items = useMemo(() => resolveItems(LIBRARY_ITEMS, marks), [marks]);
  const shown = useMemo(() => visibleItems(items, query), [items, query]);
  const counts = useMemo(() => viewCounts(items, COLLECTION_ROWS), [items]);
  const patch = useCallback((change: Partial<LibraryQuery>) => setQuery((current) => ({ ...current, ...change })), []);
  const onSource = (source: SourceId): void => patch({ source });
  const onScope = (scope: Scope): void => patch({ scope });

  return (
    <WorkspaceSplit
      surface="library"
      active={active}
      left={<LibraryRail source={query.source} counts={counts} collections={COLLECTION_ROWS} onSource={onSource} />}
      center={
        <LibraryBody
          scope={query.scope}
          inHistory={query.source === "history"}
          view={view}
          items={items}
          shown={shown}
          collections={COLLECTION_ROWS}
          selected={selected}
          onScope={onScope}
          onSelect={setSelected}
        />
      }
      right={<LibraryFilters query={query} view={view} genres={GENRES} years={YEARS} onQuery={patch} onView={setView} />}
    />
  );
}
