/** Live channel DTOs (docs/03 section 3.4). The stream address reaches the player as published. */
export type ChannelStatus = "live" | "offline" | "unknown";

export interface ChannelSummary {
  id: string;
  name: string;
  logoUrl?: string;
  category: string;
  number?: string;
  revision: number;
  /** The HLS address exactly as the admin backend has it; the player loads it. */
  streamUrl: string;
  /** The probe verdict (docs/03 section 5.2); `unknown` until the first probe. */
  status: ChannelStatus;
  /** Epoch ms of the last probe. */
  checkedAt?: number;
}

export interface ChannelList {
  /** Ordered by number, then name (docs/03 section 3.4). */
  items: ChannelSummary[];
  /** Counted over the whole view, whatever `q` and `category` narrow. */
  categories: Array<{ value: string; count: number }>;
  /** The backend revision the list was read at. */
  revision: number;
}
