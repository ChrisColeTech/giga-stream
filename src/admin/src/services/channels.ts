import type { AdminChannel, FaultName } from "@/types/admin-channel";
import { request } from "./api";
import {
  ChannelListLenientSchema,
  ChannelSchema,
  DeletedChannelSchema,
  FaultAnswerSchema,
  type ChannelList,
} from "./schemas/channel-schema";
import type { RecordInput, RecordService } from "./service-types";

/** What a fault call answers: the channel and the fault now set, or null once cleared. */
export interface FaultAnswer {
  readonly id: string;
  readonly fault: FaultName | null;
}

/** The Channels routes (`29` section 9.1, `36` section 3.1), REAL. A create, update, rebuild and revert answer the channel
 *  (parsed with `ChannelSchema`; one that does not parse is `backend.bad_response`, after which the flows read the list
 *  again, since the write may have happened). The list is read row by row: an unreadable row is dropped and counted. A
 *  refusal arrives as an `ApiError` carrying the backend's `details.field` (`name`, `number`, `folder`, `videos.<n>`...). */
export interface ChannelsService extends RecordService<AdminChannel, string, ChannelList> {
  /** `POST /channels/:id/rebuild`: the live channel, `preparing`. */
  rebuild: (id: string) => Promise<AdminChannel>;
  /** `POST /channels/:id/revert`: a synced stream channel, its edits cleared. */
  revert: (id: string) => Promise<AdminChannel>;
  /** `PUT /channels/:id/fault` with `{ fault, durationMs?, delayMs? }`. */
  applyFault: (id: string, fault: RecordInput) => Promise<FaultAnswer>;
  /** `DELETE /channels/:id/fault`. */
  clearFault: (id: string) => Promise<FaultAnswer>;
}

const path = (id: string, rest = ""): string => `/api/channels/${encodeURIComponent(id)}${rest}`;

async function list(): Promise<ChannelList> {
  const answer = await request("/api/admin-channels", ChannelListLenientSchema);
  const items: AdminChannel[] = [];
  for (const row of answer.items) {
    const parsed = ChannelSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, revision: answer.revision, unreadable: answer.items.length - items.length };
}

export const channels: ChannelsService = {
  list,
  create: (input) => request("/api/channels", ChannelSchema, { method: "POST", body: input }),
  update: (id, patch) => request(path(id), ChannelSchema, { method: "PATCH", body: patch }),
  remove: (id) => request(path(id), DeletedChannelSchema, { method: "DELETE" }),
  rebuild: (id) => request(path(id, "/rebuild"), ChannelSchema, { method: "POST" }),
  revert: (id) => request(path(id, "/revert"), ChannelSchema, { method: "POST" }),
  applyFault: (id, fault) => request(path(id, "/fault"), FaultAnswerSchema, { method: "PUT", body: fault }),
  clearFault: (id) => request(path(id, "/fault"), FaultAnswerSchema, { method: "DELETE" }),
};
