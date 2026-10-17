import { parsePlayerPolicy, type PlayerPolicyAuthority } from "./player-policy.js";

export const SET_PLAYER_POLICY_CHANNEL = "poc:set-player-policy";
export const CLEAR_PLAYER_POLICY_CHANNEL = "poc:clear-player-policy";

type PolicyIpcEvent = { senderFrame?: { readonly frameTreeNodeId: number } | null };
type PolicyIpc = {
  handle: (channel: string, listener: (event: PolicyIpcEvent, ...args: unknown[]) => unknown) => void;
};

function requireAppFrame(appFrameId: number, senderFrameId: number | undefined): void {
  if (senderFrameId !== appFrameId) {
    throw new Error("Player policy is available only to the app frame.");
  }
}

export function installPlayerPolicyIpc(
  ipc: PolicyIpc,
  currentAppFrameId: () => number,
  canAcceptPolicy: () => boolean,
  authority: PlayerPolicyAuthority,
): void {
  ipc.handle(SET_PLAYER_POLICY_CHANNEL, (event, value: unknown, ...extra: unknown[]) => {
    requireAppFrame(currentAppFrameId(), event.senderFrame?.frameTreeNodeId);
    if (!canAcceptPolicy()) throw new Error("Player policy is unavailable while the app document is changing.");
    if (extra.length !== 0) throw new TypeError("Player policy accepts one value.");
    authority.set(parsePlayerPolicy(value));
  });
  ipc.handle(CLEAR_PLAYER_POLICY_CHANNEL, (event, ...extra: unknown[]) => {
    requireAppFrame(currentAppFrameId(), event.senderFrame?.frameTreeNodeId);
    if (!canAcceptPolicy()) throw new Error("Player policy is unavailable while the app document is changing.");
    if (extra.length !== 0) throw new TypeError("Clearing player policy accepts no values.");
    authority.clear();
  });
}
