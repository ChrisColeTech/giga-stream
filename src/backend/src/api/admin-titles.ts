import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { CHANNEL_BODY_LIMIT_BYTES } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { TitleInputSchema, TitlePatchSchema } from "../types/title-input.js";
import { StoredTitlesQuerySchema } from "../types/title-stored.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/** The explicit add from Browse TMDB: the title id (`movie-603`, `tv-1396`) of the one title to fetch and store. */
const FromTmdbBody = z.object({ id: z.string().regex(/^(movie|tv)-[1-9]\d{0,9}$/) }).strict();

// A title made by hand is `custom-<uuid>`: 43 characters.
const TitleParams = z.object({ titleId: z.string().min(3).max(60) });

/** The Library fill takes no settings of its own: they are the job's. */
const SyncBody = z.object({}).strict();

/** A manual series can run past the default body limit (100 seasons of up to 500 episodes; docs/29 B3). */
const WRITE = { bodyLimit: CHANNEL_BODY_LIMIT_BYTES };

/**
 * The admin's title routes (docs/26 decision D20, docs/47): the Library fill - any signed-in admin, one job
 * at a time - full CRUD, audited, never the channel revision, and the sync status, stored list and deleted
 * list (docs/41 section 3.2). Every path here is `/api/admin/titles/...`. The public reads of the store are
 * `titles.ts`; Browse TMDB is `admin-tmdb.ts`.
 */
export function registerAdminTitles(app: FastifyInstance, services: Services): void {
  app.get("/titles/sync", async (request, reply) => {
    await signedIn(services, request);
    return ok(reply, await services.titles.status());
  });

  // Starts the Library fill job (docs/44 section 2): the same stoppable run, with progress, as `Run job` on it.
  app.post("/titles/sync", async (request, reply) => {
    const principal = await signedIn(services, request);
    parseInput(SyncBody, request.body ?? {}, ERRORS.syncInvalid);
    await services.jobs.startLibraryFill(actorOf(request, principal));
    return ok(reply, { started: true, ...(await services.titles.status()) }, 202);
  });

  // Full CRUD (docs/26 decision D20): any signed-in admin, audited, and never the channel revision.
  app.post("/titles", WRITE, async (request, reply) => {
    const principal = await signedIn(services, request);
    const input = parseInput(TitleInputSchema, request.body, ERRORS.titleInvalid);
    return ok(reply, await services.titles.create(input, actorOf(request, principal)), 201);
  });

  // The explicit add (docs/47 section 3.3): fetches ONE title's detail from TMDB and stores it; audited `title.created`.
  app.post("/titles/from-tmdb", async (request, reply) => {
    const principal = await signedIn(services, request);
    const body = parseInput(FromTmdbBody, request.body, ERRORS.titleInvalid);
    return ok(reply, await services.titles.addFromTmdb(body.id, actorOf(request, principal)), 201);
  });

  // Every stored title, paged, searched, filtered and sorted from the store alone: never TMDB (docs/41 section 3.2).
  app.get("/titles/stored", async (request, reply) => {
    await signedIn(services, request);
    const query = parseInput(StoredTitlesQuerySchema, request.query, ERRORS.requestInvalid);
    return ok(reply, await services.storedTitles.page(query));
  });

  // The deleted synced titles (docs/03 section 7.4): listed, and restored by removing the record.
  app.get("/titles/deleted", async (request, reply) => {
    await signedIn(services, request);
    return ok(reply, await services.titles.listDeleted());
  });

  app.delete("/titles/deleted/:titleId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.restore(titleId, actorOf(request, principal)));
  });

  app.patch("/titles/:titleId", WRITE, async (request, reply) => {
    const principal = await signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    const patch = parseInput(TitlePatchSchema, request.body, ERRORS.titleInvalid);
    return ok(reply, await services.titles.update(titleId, patch, actorOf(request, principal)));
  });

  app.delete("/titles/:titleId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.remove(titleId, actorOf(request, principal)));
  });

  app.post("/titles/:titleId/revert", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { titleId } = parseInput(TitleParams, request.params);
    return ok(reply, await services.titles.revert(titleId, actorOf(request, principal)));
  });
}
