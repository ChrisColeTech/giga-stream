import type { AdminTitleRow } from "@/services/schemas/title-schema";

/* Two searches (one per kind) made into one page (`37` section 4.2), pure: the rows merged and ordered by title, a row
 * that both answered kept once, the larger `totalPages`, the results added. */

export interface TitlePage {
  readonly items: readonly AdminTitleRow[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalResults: number;
}

const byTitle = (a: AdminTitleRow, b: AdminTitleRow): number =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);

export function mergePages(pages: readonly TitlePage[], page: number): TitlePage {
  if (pages.length === 1 && pages[0] !== undefined) return pages[0];
  const seen = new Set<string>();
  const items: AdminTitleRow[] = [];
  for (const one of pages) {
    for (const item of one.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return {
    items: items.sort(byTitle),
    page,
    totalPages: Math.max(1, ...pages.map((one) => one.totalPages)),
    totalResults: pages.reduce((sum, one) => sum + one.totalResults, 0),
  };
}
