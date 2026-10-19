import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AUDIT_PAGE_MAX } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const AuditQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(AUDIT_PAGE_MAX).optional(),
    before: z.coerce.number().int().min(1).optional(),
  })
  .strict();

/** The audit log (docs/03 section 7.13): any signed-in admin, newest first, under `/api/admin/audit`. */
export function registerAudit(app: FastifyInstance, services: Services): void {
  app.get("/audit", async (request, reply) => {
    await signedIn(services, request);
    const { limit, before } = parseInput(AuditQuery, request.query);
    return ok(reply, await services.audit.page(limit, before));
  });
}
