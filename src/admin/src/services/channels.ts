import { LIVE_ROWS_PATH, pagePath, type ChannelQuery } from "@/lib/channel-query";
import type { AdminChannel } from "@/types/admin-channel";
import { request } from "./api";
import {
  ChannelListLenientSchema,
  ChannelPageLenientSchema,
  ChannelSchema,
  ChannelSwitchedSchema,
  DeletedChannelSchema,
  type ChannelList,
  type ChannelPage,
  type ChannelSwitched,
  type ChannelVerdict,
} from "./schemas/channel-schema";
import type { RecordService } from "./service-types";

/** The Channels routes (`29` section 9.1, `36` section 3.1), REAL. A create, update, rebuild and revert answer the channel
 *  (parsed with `ChannelSchema`; one that does not parse is `backend.bad_response`, after which the flows read the list
 *  again, since the write may have happened). The list is read row by row: an unreadable row is dropped and counted. A
 *  refusal arrives as an `ApiError` carrying the backend's `details.field` (`name`, `number`, `folder`, `videos.<n>`...). */
export interface ChannelsService extends RecordService<AdminChannel, string, ChannelList> {
  /** One page of the list: the rows `pageIndex * limit` on (100 by default), the query's `total` and the revision. */
  page: (query: ChannelQuery, pageIndex: number, limit?: number) => Promise<ChannelPage>;
  /** Every live channel, for the statusbar's count. */
  liveRows: () => Promise<ChannelPage>;
  /** `POST /channels/:id/rebuild`: the live channel, `preparing`. */
  rebuild: (id: string) => Promise<AdminChannel>;
  /** `POST /channels/:id/revert`: a synced stream channel, its edits cleared. */
  revert: (id: string) => Promise<AdminChannel>;
  /** `GET /api/admin/channels/:id` (`36` section 8.2): ONE channel, the list's own admin view; the Preview reads this. */
  readOne: (id: string) => Promise<AdminChannel>;
  /** `PUT /api/admin/channels/:id/status` (`36` section 8.1): a hand-set online or offline verdict on a stream channel; answers the row. */
  setStatus: (id: string, status: ChannelVerdict) => Promise<AdminChannel>;
  /** `PATCH /api/admin/channels` `{ enabled, ids }`: ONE call for up to 5,000 stream ids (no chunking); live-kind and unknown
   *  ids are skipped by the backend and counted. */
  setEnabled: (ids: readonly string[], enabled: boolean) => Promise<ChannelSwitched>;
}

const path = (id: string, rest = ""): string => `/api/admin/channels/${encodeURIComponent(id)}${rest}`;

function readable(rows: readonly unknown[]): AdminChannel[] {
  const items: AdminChannel[] = [];
  for (const row of rows) {
    const parsed = ChannelSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

async function list(): Promise<ChannelList> {
  const answer = await request("/api/admin/channels", ChannelListLenientSchema);
  const items = readable(answer.items);
  return { items, revision: answer.revision, unreadable: answer.items.length - items.length };
}

/** One page of the list by the query (`GET /api/admin/channels?limit&offset&q&kind&...`); `limit` 200 is the largest. */
async function page(query: ChannelQuery, pageIndex: number, limit?: number): Promise<ChannelPage> {
  const answer = await request(pagePath(query, pageIndex, limit), ChannelPageLenientSchema);
  const items = readable(answer.items);
  const { revision, total, offset } = answer;
  return { items, revision, total, offset, unreadable: answer.items.length - items.length };
}

/** The live channels (a handful): the rows the statusbar's `N preparing` is counted over, whatever the list shows. */
async function liveRows(): Promise<ChannelPage> {
  const answer = await request(LIVE_ROWS_PATH, ChannelPageLenientSchema);
  const items = readable(answer.items);
  return { items, revision: answer.revision, total: answer.total, offset: answer.offset, unreadable: 0 };
}

export const channels: ChannelsService = {
  list,
  page,
  liveRows,
  create: (input) => request("/api/admin/channels", ChannelSchema, { method: "POST", body: input }),
  update: (id, patch) => request(path(id), ChannelSchema, { method: "PATCH", body: patch }),
  remove: (id) => request(path(id), DeletedChannelSchema, { method: "DELETE" }),
  rebuild: (id) => request(path(id, "/rebuild"), ChannelSchema, { method: "POST" }),
  revert: (id) => request(path(id, "/revert"), ChannelSchema, { method: "POST" }),
  readOne: (id) => request(`/api/admin/channels/${encodeURIComponent(id)}`, ChannelSchema),
  setStatus: (id, status) => request(path(id, "/status"), ChannelSchema, { method: "PUT", body: { status } }),
  setEnabled: (ids, enabled) =>
    request("/api/admin/channels", ChannelSwitchedSchema, { method: "PATCH", body: { enabled, ids } }),
};
