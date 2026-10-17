/** A channel as the fileserver passes it through (`03` section 3.4). The status is a fact of the last probe. */
export type ChannelStatus = "live" | "offline" | "unknown";

export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly number?: string;
  /** An image-cache address (`03` section 3.11). */
  readonly logoUrl?: string;
  readonly revision: number;
  /** The HLS address exactly as the backend has it; the player loads it. */
  readonly streamUrl: string;
  readonly status: ChannelStatus;
  readonly checkedAt?: number;
}

export interface ChannelCategory {
  readonly value: string;
  readonly count: number;
}

export interface ChannelList {
  /** Ordered by number, then name. */
  readonly items: readonly Channel[];
  readonly categories: readonly ChannelCategory[];
  readonly revision: number;
}
