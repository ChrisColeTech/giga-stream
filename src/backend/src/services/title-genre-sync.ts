import { z } from "zod";

import { AppError } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import { KINDS } from "./title-shapes.js";

const GenreList = z.object({ genres: z.array(z.object({ id: z.number().int(), name: z.string().min(1) })) });

/**
 * The genre dictionary (docs/47 section 3.2), read from TMDB's `/genre/{movie|tv}/list` once per Library fill run and
 * kept in the store: the public `GET /api/titles/genres` serves what is stored and never asks TMDB. An answer that is
 * not a genre list leaves the stored dictionary as it was.
 */
export function createGenreSync(deps: { store: Store; tmdb: TmdbClient }) {
  const { store, tmdb } = deps;
  return async function syncGenres(signal: AbortSignal): Promise<void> {
    for (const kind of KINDS) {
      try {
        const parsed = GenreList.safeParse(await tmdb.get(`/genre/${kind}/list`, {}, { signal }));
        if (parsed.success && parsed.data.genres.length > 0) store.titles.replaceGenres(kind, parsed.data.genres);
      } catch (error: unknown) {
        // The dictionary is a side table: TMDB refusing it never fails the run (the walk reports a real outage).
        if (!(error instanceof AppError)) throw error;
      }
    }
  };
}
