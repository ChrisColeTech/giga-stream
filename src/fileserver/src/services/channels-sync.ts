import type { CachedChannelRepository } from "../store/cached-channel-repository.js";
import type { CacheStateRepository } from "../store/cache-state-repository.js";
import type { CachedChannelRow, DatasetSync } from "../types/backend-cache.js";
import { unreachable, type AdminChannel, type AdminClient } from "./admin-client.js";

/** A logo address resolved against the backend that sent it (a cached copy is a path on that backend). */
function absoluteOf(address: string, baseUrl: string): string {
  try {
    return new URL(address, `${baseUrl}/`).toString();
  } catch {
    return address;
  }
}

/**
 * The stored row of one published channel (docs/46 section A): named fields only, never a spread, so a field
 * the backend adds later is not stored by accident. The logo is the backend's cached copy when it sent one.
 */
export function channelRowOf(channel: AdminChannel, position: number, baseUrl: string): CachedChannelRow {
  const logo =
    channel.cachedLogoUrl !== undefined && channel.cachedLogoUrl !== ""
      ? absoluteOf(channel.cachedLogoUrl, baseUrl)
      : channel.logoUrl;
  return {
    id: channel.id,
    position,
    name: channel.name,
    category: channel.category,
    streamUrl: channel.streamUrl,
    revision: channel.revision,
    ...(channel.number !== undefined && { number: channel.number }),
    ...(logo !== undefined && logo !== "" && { logoUrl: logo }),
  };
}

/**
 * The channels sync (docs/46 section C): one public `GET /api/channels`, the rows replaced whole in one
 * transaction. A failure, or a quit, leaves the rows alone; only the error code is stamped, and nothing at all
 * is written once the signal has aborted.
 */
export function createChannelsSync(deps: {
  admin: AdminClient;
  channels: CachedChannelRepository;
  state: CacheStateRepository;
}): DatasetSync {
  return async ({ baseUrl, sourceKey, startedAt, signal }) => {
    const answer = await deps.admin.channels(baseUrl, signal);
    if (signal.aborted) return { ok: false, failure: unreachable };
    if (!answer.ok) {
      deps.state.markFailed("channels", answer.failure.code);
      return answer;
    }
    const rows = answer.value.items.map((channel, position) => channelRowOf(channel, position, baseUrl));
    deps.state.commitSynced("channels", { sourceKey, syncedAt: startedAt, revision: answer.value.revision }, () =>
      deps.channels.replaceAll(rows),
    );
    return { ok: true };
  };
}
