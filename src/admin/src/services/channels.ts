import type { AdminChannel } from "@/types/admin-channel";
import type { ChannelList } from "./schemas/channel-schema";
import { notConnected } from "./not-connected";
import type { RecordInput, RecordService } from "./service-types";

/** The Channels routes (`29` section 9.1): the shared four plus rebuild, revert and the fault pair. NOT CONNECTED: every
 *  method refuses with the typed not-connected error until the Channels worker replaces its body with the real call. */
export interface ChannelsService extends RecordService<AdminChannel, string, ChannelList> {
  /** `POST /channels/:id/rebuild`: the live channel, `preparing`. */
  rebuild: (id: string) => Promise<AdminChannel>;
  /** `POST /channels/:id/revert`: a synced stream channel, its edits cleared. */
  revert: (id: string) => Promise<AdminChannel>;
  /** `PUT /channels/:id/fault`. */
  applyFault: (id: string, fault: RecordInput) => Promise<{ readonly id: string; readonly fault: string | null }>;
  /** `DELETE /channels/:id/fault`. */
  clearFault: (id: string) => Promise<{ readonly id: string; readonly fault: string | null }>;
}

export const channels: ChannelsService = {
  list: () => notConnected("channels.list"),
  create: () => notConnected("channels.create"),
  update: () => notConnected("channels.update"),
  remove: () => notConnected("channels.remove"),
  rebuild: () => notConnected("channels.rebuild"),
  revert: () => notConnected("channels.revert"),
  applyFault: () => notConnected("channels.applyFault"),
  clearFault: () => notConnected("channels.clearFault"),
};
