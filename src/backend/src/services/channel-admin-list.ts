import { LIST_PAGE_MAX } from "../constants/limits.js";
import type { LiveEngine } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { AdminChannelList } from "../types/channel.js";
import type { AdminChannelPage, AdminChannelQuery, ChannelFilter } from "../types/channel-query.js";
import { adminChannel } from "./channel-views.js";

/**
 * The admin's channel list (docs/41 section 3.1). Without `limit` it is the old whole answer, every row decorated.
 * With it, one page is read in SQL and only the returned rows are decorated with the engine's state. A `state` filter
 * asks the engine about the live rows (a handful), keeps the ones in that state and applies them as an id set; it
 * implies `kind=live`, as `origin` implies `kind=stream` (both together match nothing).
 */
export function adminChannels(
  store: Store,
  live: LiveEngine,
  base: string,
  query?: AdminChannelQuery,
): AdminChannelList | AdminChannelPage {
  const revision = store.revisions.current();
  if (query?.limit === undefined) {
    return { items: store.channels.list().map((record) => adminChannel(record, base, live)), revision };
  }
  const { limit, offset = 0, sort = "number", dir = "asc", state, ...rest } = query;
  const filter: ChannelFilter = { ...rest };
  if (state !== undefined) {
    filter.ids = store.channels.liveIds().filter((id) => live.status(id).state === state);
  }
  const { rows, total } = store.channels.page({ filter, sort, dir, limit: Math.min(limit, LIST_PAGE_MAX), offset });
  return { items: rows.map((record) => adminChannel(record, base, live)), revision, total, offset, limit };
}
