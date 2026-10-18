import type { AdminChannel } from "@/types/admin-channel";
import { request } from "./api";
import { ChannelListLenientSchema, ChannelSchema, DeletedChannelSchema, type ChannelList } from "./schemas/channel-schema";
import type { RecordService } from "./service-types";

/** The Channels routes (`29` section 9.1, `36` section 3.1), REAL. A create, update, rebuild and revert answer the channel
 *  (parsed with `ChannelSchema`; one that does not parse is `backend.bad_response`, after which the flows read the list
 *  again, since the write may have happened). The list is read row by row: an unreadable row is dropped and counted. A
 *  refusal arrives as an `ApiError` carrying the backend's `details.field` (`name`, `number`, `folder`, `videos.<n>`...). */
export interface ChannelsService extends RecordService<AdminChannel, string, ChannelList> {
  /** `POST /channels/:id/rebuild`: the live channel, `preparing`. */
  rebuild: (id: string) => Promise<AdminChannel>;
  /** `POST /channels/:id/revert`: a synced stream channel, its edits cleared. */
  revert: (id: string) => Promise<AdminChannel>;
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
};
