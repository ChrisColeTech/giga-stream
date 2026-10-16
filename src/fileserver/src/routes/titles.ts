import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const TitleParams = z.object({ titleId: z.string().min(3).max(30) });
const SeasonParams = z.object({ titleId: z.string().min(3).max(30), season: z.coerce.number().int().min(0).max(100) });

/** The titles pass-through (docs/03 section 3.6): three reads, one service call each. */
export function registerTitlesRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/titles/:titleId", async (request) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return okEnvelope(await services.titles.detail(titleId));
  });

  app.get("/api/titles/:titleId/seasons/:season", async (request) => {
    const { titleId, season } = parseInput(SeasonParams, request.params);
    return okEnvelope(await services.titles.season(titleId, season));
  });

  app.get("/api/titles/:titleId/related", async (request) => {
    const { titleId } = parseInput(TitleParams, request.params);
    return okEnvelope(await services.titles.related(titleId));
  });
}
