import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import type { LibraryQuery } from "../lib/library-query.js";

const OneGenre = z.string().trim().min(1).max(60);
/** `genre` is repeatable; Fastify answers one value as a string and several as an array. */
const GenreList = z.union([OneGenre, z.array(OneGenre)]).transform((value) => (Array.isArray(value) ? value : [value]));

const LibraryQuerySchema = z.object({
  view: z.enum(["all", "history", "favorites", "collection"]).default("all"),
  collectionId: z.string().min(1).max(200).optional(),
  type: z.enum(["all", "movie", "tv", "local"]).default("all"),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["newest", "oldest", "az", "year", "trending"]).default("newest"),
  genre: GenreList.optional(),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
  watched: z.enum(["all", "unwatched", "watching", "watched"]).default("all"),
  cursor: z.string().min(1).max(500).optional(),
});

/** `GET /api/library`, `GET /api/library/continue` and `POST /api/library/refresh` (docs/03 sections 3.5 and 5.1). */
export function registerLibraryRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/library", async (request) => {
    const parsed = parseInput(LibraryQuerySchema, request.query);
    const query: LibraryQuery = {
      view: parsed.view,
      type: parsed.type,
      sort: parsed.sort,
      watched: parsed.watched,
      genres: parsed.genre ?? [],
      ...(parsed.collectionId !== undefined && { collectionId: parsed.collectionId }),
      ...(parsed.q !== undefined && { q: parsed.q }),
      ...(parsed.year !== undefined && { year: parsed.year }),
      ...(parsed.cursor !== undefined && { cursor: parsed.cursor }),
    };
    return okEnvelope(await services.library.page(query));
  });

  app.get("/api/library/continue", async () => okEnvelope(await services.library.continuePage()));

  // Forced and awaited: it joins a sync in flight, and answers 503/502 with the cache still serving (docs/03 5.1).
  app.post("/api/library/refresh", async () => okEnvelope(await services.library.refresh()));
}
