import type { LiveEngine } from "../live/engine/live-engine.js";
import type { AdminChannel, BackendChannel, ChannelRecord, LiveRecord } from "../types/channel.js";
import type { LiveSpec } from "../types/live-stream.js";

/** The relative address a cached logo is served at; the admin is same-origin, so no Host-derived URL (docs/43 3.1). */
const CACHED_LOGO_PREFIX = "/logos/c/";

/** What the engine builds a live row from: its encoding and exactly one of a folder or the listed videos. */
export function liveSpecOf(record: LiveRecord): LiveSpec {
  const { mode, captions, variants, folder, videos } = record.live;
  return { id: record.id, mode, captions, variants, ...(folder !== null ? { folder } : { videos }) };
}

/**
 * A row as the public reads answer it (docs/03 section 7.2). A live row's addresses are the backend's own,
 * built from the caller's origin at read time (docs/26 decision D3), so they work from where it was asked;
 * a live row's folder and paths stay out of a public answer.
 */
export function publicChannel(record: ChannelRecord, base: string): BackendChannel {
  const core = {
    id: record.id,
    name: record.name,
    category: record.category,
    ...(record.number !== null && { number: record.number }),
    revision: record.revision,
  };
  if (record.kind === "live") {
    return {
      ...core,
      kind: "live",
      logoUrl: `${base}/logos/${record.id}.png`,
      streamUrl: `${base}/live/${record.id}/master.m3u8`,
    };
  }
  return {
    ...core,
    kind: "stream",
    ...(record.logoUrl !== null && { logoUrl: record.logoUrl }),
    ...(record.tvgId !== null && { tvgId: record.tvgId }),
    ...(record.source !== null && { source: record.source }),
    streamUrl: record.streamUrl,
  };
}

/** The admin's full view (docs/26 section 3.3): the public fields, and for a live row its settings and state. */
export function adminChannel(record: ChannelRecord, base: string, engine: LiveEngine): AdminChannel {
  const view = publicChannel(record, base);
  if (record.kind === "stream") {
    return {
      ...view,
      kind: "stream",
      enabled: record.enabled,
      published: record.published,
      ...(record.editedFields.length > 0 && { editedFields: record.editedFields }),
      ...(record.playlistId !== null && { playlistId: record.playlistId }),
      ...(record.playlistName !== null && { playlistName: record.playlistName }),
      ...(record.status !== null && { status: record.status }),
      ...(record.checkedAt !== null && { checkedAt: record.checkedAt }),
      ...(record.logoFile !== null && { cachedLogoUrl: `${CACHED_LOGO_PREFIX}${record.logoFile}` }),
    };
  }
  const { mode, captions, variants, folder, videos } = record.live;
  return {
    ...view,
    kind: "live",
    enabled: record.enabled,
    published: record.published,
    mode,
    captions,
    variants,
    ...(folder !== null && { folder }),
    ...(videos.length > 0 && { videos }),
    ...engine.status(record.id),
  };
}
