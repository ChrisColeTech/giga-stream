import { describeTarget } from "./navigation.js";
import type { GuardReport } from "./guards.js";
import type { FrameIdentity, PlayerPolicyAuthority } from "./player-policy.js";

export type GuardedFrame = FrameIdentity & {
  isDestroyed: () => boolean;
  executeJavaScript: (code: string) => Promise<unknown>;
};

export const DIALOG_GUARD_SCRIPT = `(() => {
  Object.defineProperties(globalThis, {
    alert: { configurable: true, value: () => undefined },
    confirm: { configurable: true, value: () => false },
    prompt: { configurable: true, value: () => null }
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
    const revision = this.#authority.revision;
    const target = describeTarget(frame.url);
    this.#authority.forgetInstallation(frame.frameTreeNodeId);
    let execution: Promise<unknown>;
    try {
      execution = frame.executeJavaScript(DIALOG_GUARD_SCRIPT);
    } catch {
      this.#reportFailure(target);
      return;
    }
    void execution.then(
      () => this.#authority.markInstalled(frame, revision),
      () => this.#reportFailure(target),
    );
  }

  #reportFailure(target: string): void {
    this.#report({ kind: "dialog guard failure", url: target, blocked: false });
  }
}
