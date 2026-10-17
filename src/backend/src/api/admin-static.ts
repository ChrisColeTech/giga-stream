import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { parseInput } from "./parse-input.js";

const AdminParams = z.object({ "*": z.string().max(500) });

/**
 * The built admin app at `/admin/` (docs/26 section 4.1), the one other root address besides the live streams
 * (`01` section 4.3): files from `ADMIN_DIST`, `index.html` for an app path, and nothing at all while the
 * folder has no `index.html`. Same origin as the API, so the app needs no CORS.
 */
export function registerAdminStatic(app: FastifyInstance, services: Services): void {
  app.get("/admin", async (_request, reply) => {
    if (!(await services.adminStatic.available())) throw new AppError(ERRORS.routeNotFound);
    return reply.redirect("/admin/");
  });

  app.get("/admin/*", async (request, reply) => {
    const params = parseInput(AdminParams, request.params);
    const answer = await services.adminStatic.read(params["*"]);
    if (answer === null) throw new AppError(ERRORS.routeNotFound);
    return reply
      .header("content-type", answer.contentType)
      .header("cache-control", answer.cacheControl)
      .header("x-content-type-options", "nosniff")
      // The admin signs in and changes records: no other site may frame it or learn which page opened it.
      .header("x-frame-options", "DENY")
      .header("referrer-policy", "same-origin")
      .send(answer.body);
  });
}
