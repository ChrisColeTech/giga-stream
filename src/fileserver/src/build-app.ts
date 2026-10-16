import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { fail } from "./routes/envelope.js";
import { registerHealth } from "./routes/health.js";
import { registerPocResults } from "./routes/poc-results.js";
import { createPocResultsService } from "./services/poc-results-service.js";

/** The parts of the served folder a browser may load; the PoC's scripts and results are not among them. */
const SERVED_TOP = new Set(["html", "css", "js", "data"]);

function isServed(pathName: string): boolean {
  const parts = pathName.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.length === 1) return parts[0] === "index.html";
  return SERVED_TOP.has(parts[0] ?? "");
}

/** The one Fastify instance (docs/01 section 4.1): static files from WEB_DIST and the routes. */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: "info" }, bodyLimit: 8 * 1024 * 1024 });

  await app.register(fastifyStatic, {
    root: config.webDist,
    index: ["index.html"],
    cacheControl: false,
    allowedPath: (pathName) => isServed(pathName),
  });

  registerHealth(app);
  registerPocResults(app, createPocResultsService(config.pocResultsDir));

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(fail("route.not_found", "There is nothing at that address.")));

  return app;
}
