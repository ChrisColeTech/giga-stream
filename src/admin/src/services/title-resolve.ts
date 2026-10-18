import { RESOLVE_PAGE } from "@/constants/title-stored-copy";
import type { StoredQuery } from "@/lib/title-stored-query";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import type { TitlesService } from "./titles";

/** `Select all M matching` then a bulk verb (`docs/41` section 4.5): the whole result of the query is read into memory a
 *  page of 200 at a time, in order, and the rows unticked since (`except`) are dropped. `alive` is asked before each page
 *  (the session ended: the rows read so far are answered and the caller stops). A page that fails throws. */
export async function resolveMatching(
  service: Pick<TitlesService, "listStored">,
  query: StoredQuery,
  except: ReadonlySet<string>,
  alive: () => boolean = () => true,
): Promise<AdminTitleRow[]> {
  const rows: AdminTitleRow[] = [];
  let offset = 0;
  let total = 1;
  while (offset < total && alive()) {
    const page = await service.listStored(query, offset, RESOLVE_PAGE);
    total = page.total;
    rows.push(...page.items.filter((row) => !except.has(row.id)));
    if (page.items.length === 0 && page.unreadable === 0) break;
    offset += RESOLVE_PAGE;
  }
  return rows;
}
