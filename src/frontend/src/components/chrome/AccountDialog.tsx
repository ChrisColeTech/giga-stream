import { useEffect } from "react";
import { Button } from "@giga/ui/controls/Button";
import { AccountSignOut } from "@/components/chrome/AccountSignOut";
import type { SessionActor } from "@/types/auth";

/* The family dialog (`50` section 2.6): the one scrim over the app, the card above it. The titlebar's drag strip
 * lies under the scrim, so the card repeats its no-drag word - a drag here would move a window whose owner cannot
 * see it. */
const SCRIM = "fixed inset-0 z-60 bg-scrim [-webkit-app-region:no-drag]";
const CARD =
  "fixed top-1/2 left-1/2 z-61 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 " +
  "rounded-card border border-border bg-surface p-6 shadow-[var(--shadow-stroke-hi)] " +
  "[-webkit-app-region:no-drag]";

/** Whether a key press dismisses the dialog: Escape alone (`63` section 3.5). Pure. */
export function dialogDismisses(key: string): boolean {
  return key === "Escape";
}

export interface AccountDialogProps {
  /** Who the session belongs to; null mounts the signed-out handoff. A prop, so the dialog is presentational and
   *  SSR-testable apart from the store (`AccountSignOut`'s seam): the control reads the store and re-renders here
   *  when the session dies under the open dialog (a 401), which is how the handoff arrives. */
  readonly session: SessionActor | null;
  /** Opens the gate wall: the signed-out handoff's one action, after this dialog closes. */
  readonly onGate: () => void;
  /** Closes the dialog; the control that opened it takes focus back. */
  readonly onClose: () => void;
}

/** The signed-in Account control's dialog (`63` section 3.5): who is signed in and Sign out. The gate is not here
 *  any more - it opens as the admin console's full-screen wall (`34` sections 2 and 4, `components/gate`). Escape
 *  or a backdrop press closes it. When the session ends while the dialog is open (a 401 under it), the dialog can
 *  no longer offer a sign-out, so it becomes a handoff: the backdrop stops dismissing and the one action opens
 *  the wall, which owns dismissal. */
export function AccountDialog({ session, onGate, onClose }: AccountDialogProps) {
  useEffect(() => {
    /* Capture, so the press is spent here before the shell's own keys see it. */
    const onKey = (event: KeyboardEvent): void => {
      if (!dialogDismisses(event.key)) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const signedIn = session !== null;
  const handoff = (): void => {
    onClose();
    onGate();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Account">
      {signedIn && <div className={SCRIM} aria-hidden onClick={onClose} />}
      <div className={CARD}>
        {signedIn ? (
          <AccountSignOut username={session?.username ?? null} onDone={onClose} />
        ) : (
          <div className="flex w-full flex-col gap-4">
            <h2 className="m-0 mb-1 font-mono text-base font-semibold text-text">Session</h2>
            <p className="m-0 text-sm text-faint">
              You are signed out. Sign in again from the full-screen gate.
            </p>
            <div className="pt-1">
              <Button variant="primary" size="lg" full onClick={handoff}>
                Open the full-screen gate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
