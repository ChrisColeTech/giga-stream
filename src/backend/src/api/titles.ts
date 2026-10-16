import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { SORTS } from "../services/title-service.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
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

const TitleParams = z.object({ titleId: z.string().min(3).max(30) });
const SeasonParams = z.object({ titleId: z.string().min(3).max(30), season: z.coerce.number().int().min(0).max(100) });

const SyncBody = z
  .object({
    scope: z.enum(["trending", "popular", "titles"]),
    kind: z.enum(["movie", "tv"]).optional(),
    pages: z.coerce.number().int().min(1).max(25).optional(),
    ids: z.array(z.coerce.number().int().min(1)).min(1).max(500).optional(),
  })
  .strict()
  .refine((v) => v.scope !== "titles" || (v.ids !== undefined && v.kind === undefined && v.pages === undefined), {
    message: "scope titles takes ids only",
    path: ["ids"],
  })
  .refine((v) => v.scope === "titles" || v.kind !== undefined, {
    message: "kind is required for trending and popular",
    path: ["kind"],
  });

/**
 * Titles (docs/03 sections 7.4, 7.6b): public reads so the fileserver can pass them through, and the
 * catalog sync — owner or editor, one job at a time.
 */
export function registerTitles(app: FastifyInstance, services: Services): void {
  app.get("/api/titles", async (request, reply) => {
    const query = parseInput(BrowseQuery, request.query, ERRORS.requestInvalid);
    const kinds: ("movie" | "tv")[] = query.kind === "all" ? ["movie", "tv"] : [query.kind];
    const answers = await Promise.all(
      kinds.map((kind) =>
        services.titles.browse({ ...query, kind }),
      ),
    );
    const items = answers.flatMap((a) => a.items);
    return ok(reply, {
      items,
      page: query.page,
      totalPages: Math.max(...answers.map((a) => a.totalPages)),
      totalResults: answers.reduce((sum, a) => sum + a.totalResults, 0),
    });
  });

  app.get("/api/titles/search", async (request, reply) => {
    const query = parseInput(SearchQuery, request.query, ERRORS.requestInvalid);
    const answer = await services.titles.search(query.kind, query.q, query.page);
    return ok(reply, answer);
  });

  app.get("/api/titles/genres", async (request, reply) => {
    const query = parseInput(z.object({ kind: z.enum(["movie", "tv"]).default("movie") }), request.query);
    return ok(reply, await services.titles.genres(query.kind));
  });

  app.get("/api/titles/sync", async (request, reply) => {
    signedIn(services, request, ANY_ADMIN);
    return ok(reply, services.titles.status());
  });

  app.post("/api/titles/sync", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const body = parseInput(SyncBody, request.body, ERRORS.syncInvalid);
    services.titles.startSync(body, actorOf(request, principal));
    return ok(reply, { started: true, ...services.titles.status() }, 202);
  });

  app.get("/api/titles/:titleId", async (request, reply) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.detail(titleId));
  });

  app.get("/api/titles/:titleId/seasons/:season", async (request, reply) => {
    const params = parseInput(SeasonParams, request.params);
    return ok(reply, await services.titles.seasons(params.titleId, params.season));
  });

  app.get("/api/titles/:titleId/recommendations", async (request, reply) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.recommendations(titleId));
  });
}
