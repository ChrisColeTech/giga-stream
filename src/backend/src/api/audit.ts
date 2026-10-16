import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AUDIT_PAGE_MAX } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { OWNER, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const AuditQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(AUDIT_PAGE_MAX).optional(),
    before: z.coerce.number().int().min(1).optional(),
  })
  .strict();

/** The audit log (docs/03 section 7.13): owners only, newest first. */
export function registerAudit(app: FastifyInstance, services: Services): void {
  app.get("/api/audit", async (request, reply) => {
    signedIn(services, request, OWNER);
    const { limit, before } = parseInput(AuditQuery, request.query);
    return ok(reply, services.audit.page(limit, before));
  });
}
