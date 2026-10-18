import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AppError } from "../lib/app-error.js";
import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const ChannelsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(200).optional(),
});
const LastBody = z.object({ channelId: z.string().min(1).max(200) }).strict();

/** `GET /api/channels`, `POST /api/channels/refresh`, `PATCH /api/channels/last` (docs/03 section 3.4). */
export function registerChannelsRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/channels", async (request) => {
    const query = parseInput(ChannelsQuery, request.query);
    return okEnvelope((await services.live.list(query)).list);
  });

  app.post("/api/channels/refresh", async (_request, reply) => {
    const read = await services.live.refresh();
    if ("failure" in read) {
      throw new AppError(read.failure.code, read.failure.status, read.failure.message);
    }
    reply.code(200);
    return okEnvelope(read.list);
  });

  app.patch("/api/channels/last", async (request) => {
    const body = parseInput(LastBody, request.body);
    if (!(await services.live.knows(body.channelId))) {
      throw new AppError("channel.not_found", 404, "That channel is not in the live view.");
    }
    services.channelState.writeLastChannelId(body.channelId);
    return okEnvelope({ id: body.channelId });
  });
}
