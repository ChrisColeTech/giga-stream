import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { JobInputSchema, JobPatchSchema } from "../types/job.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const JobParams = z.object({ jobId: z.string().regex(/^\d{1,12}$/) });

/**
 * The sync jobs (docs/26 section 3.11, docs/43 section 3.4): records with a type, `Enabled`, a schedule and a config,
 * for a signed-in admin, audited. `POST` creates catalog jobs only (a playlist's job is made with the playlist) and
 * `DELETE` refuses a playlist's job. `run` STARTS the job and answers `202` with the job as it stands, `running`;
 * the result is read on a refresh. `events` is the one read-only progress stream (docs/44 section 3.3). Every path
 * here is `/api/admin/jobs/...`.
 */
export function registerJobs(app: FastifyInstance, services: Services): void {
  app.get("/jobs", async (request, reply) => {
    await signedIn(services, request);
    return ok(reply, await services.jobs.list());
  });

  app.post("/jobs", async (request, reply) => {
    const principal = await signedIn(services, request);
    const input = parseInput(JobInputSchema, request.body, ERRORS.jobInvalid);
    return ok(reply, await services.jobs.create(input, actorOf(request, principal)), 201);
  });

  // Before `/jobs/:jobId`. A hijacked reply skips every hook (CORS, `no-store`), so the headers are written by hand;
  // the subscriber joins in the same synchronous step that writes the snapshot. No heartbeat, no timer (docs/44 section 3.3).
  app.get("/jobs/events", async (request, reply) => {
    await signedIn(services, request);
    services.events.assertRoom();
    reply.hijack();
    const { raw } = reply;
    // What earlier hooks set on the reply (the CORS headers) is carried over by hand; the rest is this stream's own.
    for (const [name, value] of Object.entries(reply.getHeaders())) if (value !== undefined) raw.setHeader(name, value);
    raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    });
    const leave = services.events.attach(raw);
    request.raw.once("close", leave);
    raw.once("error", leave);
  });

  app.get("/jobs/:jobId", async (request, reply) => {
    await signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    return ok(reply, await services.jobs.get(Number(jobId)));
  });

  app.patch("/jobs/:jobId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    const patch = parseInput(JobPatchSchema, request.body, ERRORS.jobInvalid);
    return ok(reply, await services.jobs.update(Number(jobId), patch, actorOf(request, principal)));
  });

  app.delete("/jobs/:jobId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    return ok(reply, await services.jobs.remove(Number(jobId), actorOf(request, principal)));
  });

  app.post("/jobs/:jobId/run", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    return ok(reply, await services.jobs.run(Number(jobId), actorOf(request, principal)), 202);
  });

  app.post("/jobs/:jobId/stop", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    return ok(reply, await services.jobs.stop(Number(jobId), actorOf(request, principal)), 202);
  });
}
