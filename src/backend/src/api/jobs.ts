import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { JobInputSchema, JobPatchSchema, JobRunSchema } from "../types/job.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const JobParams = z.object({ jobId: z.string().regex(/^\d{1,12}$/) });

/**
 * The sync jobs (docs/26 section 3.11): records with a type, `Enabled`, a schedule and a config, for a signed-in
 * admin, audited. `run` answers `202` with the job as it stands; a playlist job is awaited, a catalog job is
 * started and says `running`.
 */
export function registerJobs(app: FastifyInstance, services: Services): void {
  app.get("/api/jobs", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.jobs.list());
  });

  app.post("/api/jobs", async (request, reply) => {
    const principal = signedIn(services, request);
    const input = parseInput(JobInputSchema, request.body, ERRORS.jobInvalid);
    return ok(reply, services.jobs.create(input, actorOf(request, principal)), 201);
  });

  app.get("/api/jobs/:jobId", async (request, reply) => {
    signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    return ok(reply, services.jobs.get(Number(jobId)));
  });

  app.patch("/api/jobs/:jobId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    const patch = parseInput(JobPatchSchema, request.body, ERRORS.jobInvalid);
    return ok(reply, services.jobs.update(Number(jobId), patch, actorOf(request, principal)));
  });

  app.delete("/api/jobs/:jobId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    return ok(reply, services.jobs.remove(Number(jobId), actorOf(request, principal)));
  });

  app.post("/api/jobs/:jobId/run", async (request, reply) => {
    const principal = signedIn(services, request);
    const { jobId } = parseInput(JobParams, request.params);
    const body = parseInput(JobRunSchema, request.body ?? {}, ERRORS.jobInvalid);
    return ok(reply, await services.jobs.run(Number(jobId), body, actorOf(request, principal)), 202);
  });
}
