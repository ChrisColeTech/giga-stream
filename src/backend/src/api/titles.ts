import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { CatalogQuerySchema } from "../types/title-catalog.js";
import { ok } from "./envelope.js";
import { isAdmin } from "./guard.js";
import { parseInput } from "./parse-input.js";

const DetailQuery = z.object({ includeDisabled: z.enum(["true", "false"]).optional() });

// A title made by hand is `custom-<uuid>`: 43 characters.
const TitleParams = z.object({ titleId: z.string().min(3).max(60) });
const SeasonParams = z.object({ titleId: z.string().min(3).max(60), season: z.coerce.number().int().min(0).max(100) });

/**
 * The public title reads (docs/03 sections 7.4, 7.6b; docs/47): the store, never TMDB, no token. A disabled
 * title is left out; `includeDisabled` with an admin's token keeps it (docs/26 3.11). The admin's title
 * routes are `admin-titles.ts`, Browse TMDB is `admin-tmdb.ts`.
 */
export function registerTitles(app: FastifyInstance, services: Services): void {
  // The stored genre dictionary (docs/47 section 3.2): never TMDB; empty until a Library fill has run.
  app.get("/api/titles/genres", async (request, reply) => {
    const query = parseInput(z.object({ kind: z.enum(["movie", "tv"]).default("movie") }), request.query);
    return ok(reply, await services.titles.genres(query.kind));
  });

  // The fileserver's sync read (docs/03 section 7.4): public, store-only, never TMDB; before `/api/titles/:titleId`.
  app.get("/api/titles/catalog", async (request, reply) => {
    const query = parseInput(CatalogQuerySchema, request.query, ERRORS.requestInvalid);
    return ok(reply, await services.titleCatalog.page(query));
  });

  // The public reads leave a disabled title out; `includeDisabled` with an admin's token keeps it (docs/26 3.11).
  const readOptions = async (request: FastifyRequest) => ({
    includeDisabled:
      parseInput(DetailQuery, request.query, ERRORS.requestInvalid).includeDisabled === "true"
      && (await isAdmin(services, request)),
  });

  app.get("/api/titles/:titleId", async (request, reply) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.detail(titleId, await readOptions(request)));
  });

  app.get("/api/titles/:titleId/seasons/:season", async (request, reply) => {
    const params = parseInput(SeasonParams, request.params);
    return ok(reply, await services.titles.seasons(params.titleId, params.season, await readOptions(request)));
  });

  app.get("/api/titles/:titleId/recommendations", async (request, reply) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.recommendations(titleId, await readOptions(request)));
  });
}
