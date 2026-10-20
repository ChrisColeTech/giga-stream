import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.js";
import { WatchIdParams, WatchWriteSchema } from "../types/user-watch.js";
import { ok } from "./envelope.js";
import { anySignedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The signed-in account's watch history (docs/63 section 3.2): the fileserver's watch verbs and answers
 * (`src/fileserver/src/routes/watch.ts`) re-pointed at the account's rows, so the fileserver's browser
 * pass-through forwards a request and returns the account's answer without translating it. Every query is
 * scoped to the principal's account, and the write applies the shared watch semantics at write time with
 * the account's own settings.
 */
export function registerAccountWatch(app: FastifyInstance, services: Services): void {
  app.put("/watch", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const body = parseInput(WatchWriteSchema, request.body);
    return ok(reply, await services.userWatch.write(principal, body));
  });

  app.delete("/watch/:watchId", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    const { watchId } = parseInput(WatchIdParams, request.params);
    return ok(reply, await services.userWatch.drop(principal, watchId));
  });

  app.delete("/watch", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    return ok(reply, await services.userWatch.clear(principal));
  });

  app.get("/watch", async (request, reply) => {
    const principal = await anySignedIn(services, request);
    return ok(reply, await services.userWatch.list(principal));
  });
}
