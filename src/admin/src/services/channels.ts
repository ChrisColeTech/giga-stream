import { notConnected, type ServiceResult } from "./not-connected";

/** Reads the channel list again and probes every stream (`03` section 3.4). Phase 1 stub. */
export function refreshChannels(): ServiceResult {
  return notConnected();
}

/** Remembers the channel Live opens on next time (`03` section 3.4). Phase 1 stub. */
export function rememberLastChannel(_channelId: string): ServiceResult {
  return notConnected();
}

/** Retries a failed stream: loads the same address again (`02` section 3.1). Phase 1 stub. */
export function retryStream(): ServiceResult {
  return notConnected();
}
