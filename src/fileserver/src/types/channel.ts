/** Live channel DTOs (docs/03 section 3.4). The stream address reaches the player as published. */

/**
 * TEMPORARY wire compatibility (docs/46 section D.2): the desktop no longer checks streams, but the interface's
 * schema still requires a `status`. Every row says `unknown` until wave W4 removes this field and the schema's
 * together.
 */
export const LEGACY_CHANNEL_STATUS = "unknown" as const;

export interface ChannelSummary {
  id: string;
  name: string;
  logoUrl?: string;
  category: string;
  number?: string;
  revision: number;
  /** The HLS address exactly as the admin backend has it; the player loads it. */
  streamUrl: string;
  /** See `LEGACY_CHANNEL_STATUS`; removed in W4. */
  status: typeof LEGACY_CHANNEL_STATUS;
}

export interface ChannelList {
  /** In the backend's order (docs/03 section 3.4). */
  items: ChannelSummary[];
  /** Counted over every cached channel, whatever `q` and `category` narrow. */
  categories: Array<{ value: string; count: number }>;
  /** The backend revision the cache was last synced at. */
  revision: number;
}
