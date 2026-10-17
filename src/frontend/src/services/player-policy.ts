export interface PlayerPolicy {
  readonly origin: string;
  readonly frameOrigins: readonly string[];
}

export interface PlayerPolicyCapability {
  readonly runtime: "electron";
  readonly setPlayerPolicy: (policy: { origin: string; frameOrigins: string[] }) => void;
  readonly clearPlayerPolicy: () => void;
}

const installedCapability = (): PlayerPolicyCapability | null => {
  if (typeof window === "undefined" || window.pocHost?.runtime !== "electron") return null;
  return window.pocHost;
};

export function setPlayerPolicy(
  policy: PlayerPolicy,
  capability: PlayerPolicyCapability | null = installedCapability(),
): boolean {
  if (capability === null) return false;
  capability.setPlayerPolicy({ origin: policy.origin, frameOrigins: [...policy.frameOrigins] });
  return true;
}

export function clearPlayerPolicy(capability: PlayerPolicyCapability | null = installedCapability()): void {
  capability?.clearPlayerPolicy();
}
