import { QueryBar } from "@giga/ui/lists/QueryBar";
import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
import { SortControl } from "@giga/ui/lists/SortControl";
import type { ListBarDef } from "@/constants/list-query-copy";
import type { ListQueryHandlers } from "@/hooks/useListQuery";
import { ANY, type ListQuery } from "@/lib/list-query";

export interface ListQueryBarProps {
  readonly def: ListBarDef;
  readonly query: ListQuery;
  readonly handlers: ListQueryHandlers;
}

/** THE QUERY ROW of an index list the admin holds whole (`01` section 9), the shared `QueryBar` Channels and Titles use:
 *  the search taking the row's width (it filters as you type, 200 ms after the last keystroke), then the Sort select with
 *  its direction toggle (omitted for a list whose columns do not sort) and a self-labelling select for each filter: the
 *  name at rest, the value in the accent when set. */
export function ListQueryBar({ def, query, handlers }: ListQueryBarProps) {
  return (
    <QueryBar
      search={<QuerySearch label={def.search} value={query.typed} onChange={handlers.type} onSearch={handlers.search} />}
    >
      {def.sorts.length > 0 && (
        <SortControl
          label="Sort"
          value={query.sort.key}
          options={def.sorts}
          onChange={handlers.sortKey}
          direction={{
            value: query.sort.dir,
            onToggle: () => handlers.direction(query.sort.dir === "asc" ? "desc" : "asc"),
          }}
        />
      )}
      {def.filters.map((filter) => (
        <QuerySelect
          key={filter.id}
          label={filter.label}
          value={query.filters[filter.id] ?? ANY}
          options={filter.options}
          onChange={(value) => handlers.filter(filter.id, value)}
        />
      ))}
    </QueryBar>
  );
}
