export type PlayerPolicy = { origin: string; frameOrigins: readonly string[] };

export type FrameIdentity = {
  readonly frameTreeNodeId: number;
  readonly parent: FrameIdentity | null;
  readonly url: string;
};

export type FrameVerdict = "allow" | "refuse";

function exactWebOrigin(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("Player frame origins must be strings.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("Player frame origins must be valid origins.");
  }
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.host === "") {
    throw new TypeError("Player frame origins must use HTTP or HTTPS.");
  }
  if (value !== parsed.origin) throw new TypeError("Player frame origins must not contain paths or credentials.");
  return parsed.origin;
}

export function parsePlayerPolicy(value: unknown): PlayerPolicy {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Player policy must be an object.");
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("origin") || !keys.includes("frameOrigins")) {
    throw new TypeError("Player policy has an unexpected shape.");
  }
  const sourceValue = "origin" in value ? value.origin : undefined;
  const frameValues = "frameOrigins" in value ? value.frameOrigins : undefined;
  if (!Array.isArray(frameValues)) throw new TypeError("Player frame origins must be an array.");
  const origin = exactWebOrigin(sourceValue);
  const frameOrigins = frameValues.map(exactWebOrigin);
  return { origin, frameOrigins: [...new Set(frameOrigins)] };
}

function navigationOrigin(target: string): string | null {
  try {
    const parsed = new URL(target);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.host === "") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isInitialization(target: string): boolean {
  return target === "" || target === "about:blank";
}

export class PlayerPolicyAuthority {
  #appFrameId: number;
  #allowedOrigins = new Set<string>();
  readonly #onReset: () => void;
  #playerFrameId: number | null = null;
  #policy: PlayerPolicy | null = null;

  constructor(appFrameId: number, onReset: () => void = () => undefined) {
    this.#appFrameId = appFrameId;
    this.#onReset = onReset;
  }

  get active(): boolean {
    return this.#policy !== null;
  }

  set(policy: PlayerPolicy): void {
    this.#policy = policy;
    this.#allowedOrigins = new Set([policy.origin, ...policy.frameOrigins]);
    this.#playerFrameId = null;
    this.#onReset();
  }

  clear(): void {
    this.#policy = null;
    this.#allowedOrigins.clear();
    this.#playerFrameId = null;
    this.#onReset();
  }

  replaceAppFrame(appFrameId: number): void {
    this.#appFrameId = appFrameId;
    this.clear();
  }

  judge(frame: FrameIdentity, target: string): FrameVerdict {
    const direct = frame.parent?.frameTreeNodeId === this.#appFrameId;
    if (direct) return this.#judgeDirect(frame, target);
    if (!this.#belowAppChild(frame)) return "allow";
    if (!this.owns(frame)) return isInitialization(target) ? "allow" : "refuse";
    return isInitialization(target) || this.#allowsOrigin(target) ? "allow" : "refuse";
  }

  owns(frame: FrameIdentity): boolean {
    for (let at: FrameIdentity | null = frame; at !== null; at = at.parent) {
      if (at.frameTreeNodeId === this.#playerFrameId) return true;
    }
    return false;
  }

  allowsFrame(frame: FrameIdentity): boolean {
    return this.owns(frame) && this.#allowsOrigin(frame.url);
  }

  #judgeDirect(frame: FrameIdentity, target: string): FrameVerdict {
    if (isInitialization(target)) {
      if (frame.frameTreeNodeId === this.#playerFrameId) this.#playerFrameId = null;
      return "allow";
    }
    if (this.#policy === null || navigationOrigin(target) !== this.#policy.origin) return "refuse";
    if (frame.frameTreeNodeId === this.#playerFrameId) return "allow";
    if (this.#playerFrameId === null && isInitialization(frame.url)) {
      this.#playerFrameId = frame.frameTreeNodeId;
      return "allow";
    }
    return "refuse";
  }

  #allowsOrigin(target: string): boolean {
    const origin = navigationOrigin(target);
    return origin !== null && this.#allowedOrigins.has(origin);
  }

  #belowAppChild(frame: FrameIdentity): boolean {
    for (let at: FrameIdentity | null = frame; at?.parent !== null; at = at.parent) {
      if (at.parent.frameTreeNodeId === this.#appFrameId) return true;
    }
    return false;
  }
}

export function judgeUnmanagedFrame(
  frame: FrameIdentity,
  target: string,
  appFrameId: number,
  directOrigins: Map<number, string>,
): FrameVerdict {
  if (frame.parent?.frameTreeNodeId !== appFrameId) return "allow";
  if (isInitialization(target)) {
    directOrigins.delete(frame.frameTreeNodeId);
    return "allow";
  }
  const origin = navigationOrigin(target);
  if (origin === null) return "refuse";
  const first = directOrigins.get(frame.frameTreeNodeId);
  if (first === undefined) {
    directOrigins.set(frame.frameTreeNodeId, origin);
    return "allow";
  }
  return origin === first ? "allow" : "refuse";
}
