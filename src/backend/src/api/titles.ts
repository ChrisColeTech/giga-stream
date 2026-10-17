import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { CHANNEL_BODY_LIMIT_BYTES } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { SORTS } from "../services/title-service.js";
import { ok } from "./envelope.js";
import { actorOf, isAdmin, signedIn } from "./guard.js";
import { TitleInputSchema, TitlePatchSchema } from "../types/title-input.js";
import { parseInput } from "./parse-input.js";

const BrowseQuery = z.object({
  kind: z.enum(["movie", "tv", "all"]).default("all"),
  sort: z.enum(SORTS).default("newest"),
  genre: z.string().max(60).optional(),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  // An admin's read also lists the disabled titles; without an admin's token it is ignored.
  includeDisabled: z.enum(["true", "false"]).optional(),
});

const SearchQuery = z.object({
  kind: z.enum(["movie", "tv"]).default("movie"),
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).max(500).default(1),
  includeDisabled: z.enum(["true", "false"]).optional(),
});
const DetailQuery = z.object({ includeDisabled: z.enum(["true", "false"]).optional() });

// A title made by hand is `custom-<uuid>`: 43 characters.
const TitleParams = z.object({ titleId: z.string().min(3).max(60) });
const SeasonParams = z.object({ titleId: z.string().min(3).max(60), season: z.coerce.number().int().min(0).max(100) });

const SyncBody = z
  .object({
    scope: z.enum(["trending", "popular", "titles"]),
    kind: z.enum(["movie", "tv"]).optional(),
    pages: z.coerce.number().int().min(1).max(25).optional(),
    // Title ids (`movie-603`, `tv-1399`), so a series is fetched as a series (docs/26 section 3.10, rule 6).
    ids: z.array(z.string().regex(/^(movie|tv)-[1-9]\d{0,9}$/)).min(1).max(500).optional(),
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

/** A manual series can run past the default body limit (100 seasons of up to 500 episodes; docs/29 B3). */
const WRITE = { bodyLimit: CHANNEL_BODY_LIMIT_BYTES };

/**
 * Titles (docs/03 sections 7.4, 7.6b): public reads so the fileserver can pass them through, and the
 * catalog sync — any signed-in admin, one job at a time.
 */
export function registerTitles(app: FastifyInstance, services: Services): void {
  app.get("/api/titles", async (request, reply) => {
    const query = parseInput(BrowseQuery, request.query, ERRORS.requestInvalid);
    const options = { includeDisabled: query.includeDisabled === "true" && isAdmin(services, request) };
    const kinds: ("movie" | "tv")[] = query.kind === "all" ? ["movie", "tv"] : [query.kind];
    const answers = await Promise.all(kinds.map((kind) => services.titles.browse({ ...query, kind }, options)));
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
    const options = { includeDisabled: query.includeDisabled === "true" && isAdmin(services, request) };
    const answer = await services.titles.search(query.kind, query.q, query.page, options);
    return ok(reply, answer);
  });

  app.get("/api/titles/genres", async (request, reply) => {
    const query = parseInput(z.object({ kind: z.enum(["movie", "tv"]).default("movie") }), request.query);
    return ok(reply, await services.titles.genres(query.kind));
  });

  app.get("/api/titles/sync", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.titles.status());
  });

  app.post("/api/titles/sync", async (request, reply) => {
    const principal = signedIn(services, request);
    const body = parseInput(SyncBody, request.body, ERRORS.syncInvalid);
    services.titles.startSync(body, actorOf(request, principal));
    return ok(reply, { started: true, ...services.titles.status() }, 202);
  });

  // Full CRUD (docs/26 decision D20): any signed-in admin, audited, and never the channel revision.
  app.post("/api/titles", WRITE, async (request, reply) => {
    const principal = signedIn(services, request);
    const input = parseInput(TitleInputSchema, request.body, ERRORS.titleInvalid);
    return ok(reply, services.titles.create(input, actorOf(request, principal)), 201);
  });

  app.patch("/api/titles/:titleId", WRITE, async (request, reply) => {
    const principal = signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    const patch = parseInput(TitlePatchSchema, request.body, ERRORS.titleInvalid);
    return ok(reply, await services.titles.update(titleId, patch, actorOf(request, principal)));
  });

  app.delete("/api/titles/:titleId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, services.titles.remove(titleId, actorOf(request, principal)));
  });

  app.post("/api/titles/:titleId/revert", async (request, reply) => {
    const principal = signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.revert(titleId, actorOf(request, principal)));
  });

  // The public reads leave a disabled title out; `includeDisabled` with an admin's token keeps it (docs/26 3.11).
  const readOptions = (request: Parameters<typeof isAdmin>[1]) => ({
    includeDisabled: parseInput(DetailQuery, request.query, ERRORS.requestInvalid).includeDisabled === "true" && isAdmin(services, request),
  });

  app.get("/api/titles/:titleId", async (request, reply) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.detail(titleId, readOptions(request)));
  });

  app.get("/api/titles/:titleId/seasons/:season", async (request, reply) => {
    const params = parseInput(SeasonParams, request.params);
    return ok(reply, await services.titles.seasons(params.titleId, params.season, readOptions(request)));
  });

  app.get("/api/titles/:titleId/recommendations", async (request, reply) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.recommendations(titleId, readOptions(request)));
  });
}
