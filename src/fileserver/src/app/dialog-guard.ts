import { describeTarget } from "./navigation.js";
import type { GuardReport } from "./guards.js";
import type { FrameIdentity, PlayerPolicyAuthority } from "./player-policy.js";

export type GuardedFrame = FrameIdentity & {
  isDestroyed: () => boolean;
  executeJavaScript: (code: string) => Promise<unknown>;
};

export const DIALOG_GUARD_SCRIPT = `(() => {
  Object.defineProperties(globalThis, {
    alert: { configurable: false, writable: false, value: () => undefined },
    confirm: { configurable: false, writable: false, value: () => true },
    prompt: { configurable: false, writable: false, value: () => null }
  });
  return true;
})()`;

export class DialogGuardInstaller {
  readonly #authority: PlayerPolicyAuthority;
  readonly #report: (entry: GuardReport) => void;

  constructor(authority: PlayerPolicyAuthority, report: (entry: GuardReport) => void) {
    this.#authority = authority;
    this.#report = report;
  }

  install(frame: GuardedFrame): void {
    if (frame.isDestroyed() || !this.#authority.allowsFrame(frame)) return;
    const target = describeTarget(frame.url);
    let execution: Promise<unknown>;
    try {
      execution = frame.executeJavaScript(DIALOG_GUARD_SCRIPT);
    } catch {
      this.#reportFailure(target);
      return;
    }
    void execution.then(
      () => undefined,
      () => this.#reportFailure(target),
    );
  }

  #reportFailure(target: string): void {
    this.#report({ kind: "dialog guard failure", url: target, blocked: false });
  }
}
