import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { SORTS } from "../services/title-service.js";
import { ok } from "./envelope.js";
import { signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const BrowseQuery = z.object({
  kind: z.enum(["movie", "tv", "all"]).default("all"),
  sort: z.enum(SORTS).default("newest"),
  genre: z.string().max(60).optional(),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

const SearchQuery = z.object({
  kind: z.enum(["movie", "tv"]).default("movie"),
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

/**
 * Browse TMDB (docs/47 section 3.3): the admin's own read of TMDB, under `/api/admin/tmdb`. Signed in, `no-store`
 * (every `/api/admin` route is), and it WRITES NOTHING: each row says whether the store holds it (`stored`) or has
 * it deleted (`deleted`). Adding a row is the explicit `POST /api/admin/titles/from-tmdb`. TMDB out of reach is
 * `503 tmdb.unavailable`.
 */
export function registerAdminTmdb(app: FastifyInstance, services: Services): void {
  app.get("/tmdb/titles", async (request, reply) => {
    await signedIn(services, request);
    const query = parseInput(BrowseQuery, request.query, ERRORS.requestInvalid);
    return ok(reply, await services.titles.browseTmdb(query));
  });

  app.get("/tmdb/search", async (request, reply) => {
    await signedIn(services, request);
    const query = parseInput(SearchQuery, request.query, ERRORS.requestInvalid);
    return ok(reply, await services.titles.searchTmdb(query.kind, query.q, query.page));
  });
}
