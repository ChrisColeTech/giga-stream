import { z } from "zod";

import type { CatalogItem, GenreEntry } from "../types/cached-title.js";
import { decodeData, fetchAdminJson, refusalOf, type AdminResult } from "./admin-client.js";
import type { TitleKind } from "./admin-titles.js";

/** A catalog page of 500 rows is about 110 KB; the same 20 second deadline as every admin read. */
export const CATALOG_TIMEOUT_MS = 20_000;

/** One page of the backend's catalog read (docs/03 section 7.4): its rows, and the id to ask after for the next. */
export interface CatalogAnswer {
  items: CatalogItem[];
  next?: string;
}

export interface AdminCatalog {
  /** `GET /api/titles/catalog?after=&limit=` — public and store-only; no `Authorization`, no cookie. */
  page(baseUrl: string, after: string | undefined, limit: number, signal: AbortSignal): Promise<AdminResult<CatalogAnswer>>;
  /** `GET /api/titles/genres?kind=` — the genre dictionary of one kind. */
  genres(baseUrl: string, kind: TitleKind, signal: AbortSignal): Promise<AdminResult<GenreEntry[]>>;
}

const ItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["movie", "tv"]),
  title: z.string(),
  year: z.number().optional(),
  rating: z.number().optional(),
  popularity: z.number().optional(),
  posterUrl: z.string().optional(),
  backdropUrl: z.string().optional(),
  genres: z.array(z.string()).default([]),
});
const PageSchema = z.object({ items: z.array(z.unknown()), next: z.string().min(1).optional() });
const GenresSchema = z.array(z.object({ id: z.number(), name: z.string() }));

/**
 * The catalog half of the admin client (docs/46 section C). A mapper picks named fields and never spreads the
 * incoming row, so a field the backend adds later is not stored by accident; a row that fails its shape is
 * skipped rather than failing the page.
 */
export function createAdminCatalog(options: { fetch?: typeof fetch } = {}): AdminCatalog {
  const doFetch = options.fetch ?? globalThis.fetch;

  async function get<S extends z.ZodTypeAny>(url: string, schema: S, signal: AbortSignal): Promise<AdminResult<z.infer<S>>> {
    const answer = await fetchAdminJson(doFetch, url, CATALOG_TIMEOUT_MS, signal);
    if (!answer.ok) return { ok: false, failure: answer.failure };
    if (answer.status < 200 || answer.status >= 300) return { ok: false, failure: refusalOf(answer.status) };
    return decodeData(schema, answer.json);
  }

  return {
    async page(baseUrl, after, limit, signal) {
      const query = new URLSearchParams({ limit: String(limit) });
      if (after !== undefined) query.set("after", after);
      const answer = await get(`${baseUrl}/api/titles/catalog?${query.toString()}`, PageSchema, signal);
      if (!answer.ok) return answer;
      const items = answer.value.items.flatMap((raw): CatalogItem[] => {
        const row = ItemSchema.safeParse(raw);
        if (!row.success) return [];
        const { id, kind, title, year, rating, popularity, posterUrl, backdropUrl, genres } = row.data;
        return [
          {
            id, kind, title, genres,
            ...(year !== undefined && { year }),
            ...(rating !== undefined && { rating }),
            ...(popularity !== undefined && { popularity }),
            ...(posterUrl !== undefined && { posterUrl }),
            ...(backdropUrl !== undefined && { backdropUrl }),
          },
        ];
      });
      return { ok: true, value: { items, ...(answer.value.next !== undefined && { next: answer.value.next }) } };
    },

    genres: (baseUrl, kind, signal) => get(`${baseUrl}/api/titles/genres?kind=${kind}`, GenresSchema, signal),
  };
}
