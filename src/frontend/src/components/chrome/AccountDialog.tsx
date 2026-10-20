import { useEffect } from "react";
import { AccountSignOut } from "@/components/chrome/AccountSignOut";
import { GateForms } from "@/components/gate/GateForms";

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
  /** Which half the dialog opened with, frozen at open: the gate's forms signed out, the session's sign-out signed
   *  in. A sign-in inside closes the dialog rather than switching its half. */
  readonly mode: "gate" | "session";
  /** Closes the dialog; the control that opened it takes focus back. */
  readonly onClose: () => void;
}

/** The gate as an overlay dialog (`63` sections 3.1 and 3.5): the app stays mounted and visible behind the scrim.
 *  Escape or a backdrop press closes it; the forms themselves are the gate's own (`components/gate`). */
export function AccountDialog({ mode, onClose }: AccountDialogProps) {
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

  return (
    <div role="dialog" aria-modal="true" aria-label="Account">
      <div className={SCRIM} aria-hidden onClick={onClose} />
      <div className={CARD}>
        {mode === "gate" ? <GateForms onSignedIn={onClose} /> : <AccountSignOut onDone={onClose} />}
      </div>
    </div>
  );
}
