import type { CachedChannelRepository } from "../store/cached-channel-repository.js";
import type { CacheStateRepository } from "../store/cache-state-repository.js";
import type { AdminChannelRepository, PublishedChannel } from "../store/admin-channel-repository.js";
import type { CachedChannelRow, DatasetSync } from "../types/backend-cache.js";
import { unreachable } from "./admin-failure.js";

/**
 * The stored row of one published channel (docs/46 section A): named fields only, never a spread, so a field
 * the backend adds later is not stored by accident. The logo is the backend's cached copy when it sent one.
 */
export function channelRowOf(channel: PublishedChannel, position: number): CachedChannelRow {
  const source = channel.cachedLogoUrl === undefined || channel.cachedLogoUrl === ""
    ? channel.logoUrl
    : channel.cachedLogoUrl;
  return {
    id: channel.id,
    position,
    name: channel.name,
    category: channel.category,
    streamUrl: channel.streamUrl,
    revision: channel.revision,
    ...(channel.number !== undefined && { number: channel.number }),
    ...(source !== undefined && source !== "" && { logoUrl: source }),
  };
}

/**
 * The channels sync (docs/46 section C, amended by docs/64): one direct publication query, rows replaced whole in one
 * transaction. A failure, or a quit, leaves the rows alone; only the error code is stamped, and nothing at all
 * is written once the signal has aborted.
 */
export function createChannelsSync(deps: {
  admin: AdminChannelRepository;
  channels: CachedChannelRepository;
  state: CacheStateRepository;
}): DatasetSync {
  return async ({ baseUrl, sourceKey, startedAt, signal }) => {
    const answer = await deps.admin.list();
    if (signal.aborted) return { ok: false, failure: unreachable };
    if (!answer.ok) {
      deps.state.markFailed("channels", answer.failure.code);
      return answer;
    }
    const rows = answer.value.items.map((channel, position) => channelRowOf(channel, position));
    deps.state.commitSynced("channels", { sourceKey, syncedAt: startedAt, revision: answer.value.revision }, () =>
      deps.channels.replaceAll(rows),
    );
    return { ok: true };
  };
}
