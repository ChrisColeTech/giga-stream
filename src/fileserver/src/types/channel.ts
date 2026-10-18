/** Live channel DTOs (docs/03 section 3.4). The stream address reaches the player as published. Nothing checks a
 *  stream, so a channel carries no status (docs/46 section D.2). */

export interface ChannelSummary {
  id: string;
  name: string;
  logoUrl?: string;
  category: string;
  number?: string;
  revision: number;
  /** The HLS address exactly as the admin backend has it; the player loads it. */
  streamUrl: string;
}

export interface ChannelList {
  /** In the backend's order (docs/03 section 3.4). */
  items: ChannelSummary[];
  /** Counted over every cached channel, whatever `q` and `category` narrow. */
  categories: Array<{ value: string; count: number }>;
  /** The backend revision the cache was last synced at. */
  revision: number;
}
