import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { CHANNEL_BODY_LIMIT_BYTES } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { actorOf, isAdmin, signedIn } from "./guard.js";
import { TitleInputSchema, TitlePatchSchema } from "../types/title-input.js";
import { CatalogQuerySchema } from "../types/title-catalog.js";
import { StoredTitlesQuerySchema } from "../types/title-stored.js";
import { parseInput } from "./parse-input.js";

/** The explicit add from Browse TMDB: the title id (`movie-603`, `tv-1396`) of the one title to fetch and store. */
const FromTmdbBody = z.object({ id: z.string().regex(/^(movie|tv)-[1-9]\d{0,9}$/) }).strict();
const DetailQuery = z.object({ includeDisabled: z.enum(["true", "false"]).optional() });

// A title made by hand is `custom-<uuid>`: 43 characters.
const TitleParams = z.object({ titleId: z.string().min(3).max(60) });
const SeasonParams = z.object({ titleId: z.string().min(3).max(60), season: z.coerce.number().int().min(0).max(100) });

/** The Library fill takes no settings of its own: they are the job's. */
const SyncBody = z.object({}).strict();

/** A manual series can run past the default body limit (100 seasons of up to 500 episodes; docs/29 B3). */
const WRITE = { bodyLimit: CHANNEL_BODY_LIMIT_BYTES };

/**
 * Titles (docs/03 sections 7.4, 7.6b; docs/47): public reads of the store (never TMDB), the Library fill - any
 * signed-in admin, one job at a time - and the records an admin makes. Browse TMDB is `admin-tmdb.ts`.
 */
export function registerTitles(app: FastifyInstance, services: Services): void {
  // The stored genre dictionary (docs/47 section 3.2): never TMDB; empty until a Library fill has run.
  app.get("/api/titles/genres", async (request, reply) => {
    const query = parseInput(z.object({ kind: z.enum(["movie", "tv"]).default("movie") }), request.query);
    return ok(reply, services.titles.genres(query.kind));
  });

  // The fileserver's sync read (docs/03 section 7.4): public, store-only, never TMDB; before `/api/titles/:titleId`.
  app.get("/api/titles/catalog", async (request, reply) => {
    const query = parseInput(CatalogQuerySchema, request.query, ERRORS.requestInvalid);
    return ok(reply, services.titleCatalog.page(query));
  });

  app.get("/api/titles/sync", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.titles.status());
  });

  // Starts the Library fill job (docs/44 section 2): the same stoppable run, with progress, as `Run job` on it.
  app.post("/api/titles/sync", async (request, reply) => {
    const principal = signedIn(services, request);
    parseInput(SyncBody, request.body ?? {}, ERRORS.syncInvalid);
    services.jobs.startLibraryFill(actorOf(request, principal));
    return ok(reply, { started: true, ...services.titles.status() }, 202);
  });

  // Full CRUD (docs/26 decision D20): any signed-in admin, audited, and never the channel revision.
  app.post("/api/titles", WRITE, async (request, reply) => {
    const principal = signedIn(services, request);
    const input = parseInput(TitleInputSchema, request.body, ERRORS.titleInvalid);
    return ok(reply, services.titles.create(input, actorOf(request, principal)), 201);
  });

  // The explicit add (docs/47 section 3.3): fetches ONE title's detail from TMDB and stores it; audited `title.created`.
  app.post("/api/titles/from-tmdb", async (request, reply) => {
    const principal = signedIn(services, request);
    const body = parseInput(FromTmdbBody, request.body, ERRORS.titleInvalid);
    return ok(reply, await services.titles.addFromTmdb(body.id, actorOf(request, principal)), 201);
  });

  // Every stored title, paged, searched, filtered and sorted from the store alone: never TMDB (docs/41 section 3.2).
  app.get("/api/titles/stored", async (request, reply) => {
    signedIn(services, request);
    const query = parseInput(StoredTitlesQuerySchema, request.query, ERRORS.requestInvalid);
    return ok(reply, services.storedTitles.page(query));
  });

  // The deleted synced titles (docs/03 section 7.4): listed, and restored by removing the record.
  app.get("/api/titles/deleted", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.titles.listDeleted());
  });

  app.delete("/api/titles/deleted/:titleId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, services.titles.restore(titleId, actorOf(request, principal)));
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
