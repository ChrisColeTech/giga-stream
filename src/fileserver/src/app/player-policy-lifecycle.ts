import type { FrameIdentity, PlayerPolicyAuthority } from "./player-policy.js";

export type NavigationStart = { readonly isMainFrame: boolean; readonly isSameDocument: boolean };

export type PlayerPolicyLifecycle = {
  didStartNavigation: (details: NavigationStart) => void;
  didCommitMainFrame: (frame: FrameIdentity) => void;
  frameCreated: (frame: FrameIdentity) => void;
  renderProcessGone: () => void;
  canAcceptPolicy: () => boolean;
};

export function playerPolicyLifecycle(authority: PlayerPolicyAuthority): PlayerPolicyLifecycle {
  let acceptingPolicy = false;
  return {
    didStartNavigation: (details) => {
      if (details.isMainFrame && !details.isSameDocument) {
        acceptingPolicy = false;
        authority.clear();
      }
    },
    didCommitMainFrame: (frame) => {
      authority.replaceAppFrame(frame.frameTreeNodeId);
      acceptingPolicy = true;
    },
    frameCreated: (frame) => {
      if (frame.parent === null) {
        acceptingPolicy = false;
        authority.replaceAppFrame(frame.frameTreeNodeId);
      }
    },
    renderProcessGone: () => {
      acceptingPolicy = false;
      authority.clear();
    },
    canAcceptPolicy: () => acceptingPolicy,
  };
}
