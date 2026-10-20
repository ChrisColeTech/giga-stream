import { useEffect } from "react";
import { GateBrand } from "./GateBrand";
import { GateForms } from "./GateForms";

/* The admin console's wall (`34` section 4): it covers the whole window, titlebar included, so nothing of the shell
 * shows behind the gate. The shell behind it is inert (App). Unlike the admin's pre-app gate there is a way out:
 * browsing signed out is this app's default (`63` section 3.1), so Escape closes the wall back to the shell. */
const WALL = "fixed inset-0 z-75 flex flex-col bg-bg";

/** Whether a key press dismisses the wall: Escape alone (`63` section 3.5). Pure. */
export function gateWallDismisses(key: string): boolean {
  return key === "Escape";
}

export interface GateWallProps {
  /** The wall is leaving: Escape pressed or the sign-in accepted. The shell wakes and the Account control that
   *  opened the wall takes focus back. */
  readonly onClose: () => void;
}

/** The gate as a full-screen wall, the admin console's sign-in template (`34` sections 2 and 4): the brand column
 *  left, the gate's own forms centred in the rest, a drag strip over the top 40px so the desktop window can still be
 *  moved. Escape closes it; signing in closes it. It scrolls inside the window when the window is short. */
export function GateWall({ onClose }: GateWallProps) {
  useEffect(() => {
    /* Capture, so the press is spent here before the shell's own keys see it. */
    const onKey = (event: KeyboardEvent): void => {
      if (!gateWallDismisses(event.key)) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign in to Giga Stream" className={WALL}>
      {/* Overlays the columns rather than sitting above them, so the brand column is not pushed down 40px. */}
      <div className="absolute inset-x-0 top-0 z-1 h-10 [-webkit-app-region:drag]" />
      <div className="relative flex min-h-0 flex-1">
        <GateBrand />
        <div className="flex min-w-0 flex-1 overflow-y-auto bg-surface">
          <div className="m-auto flex w-full max-w-104 flex-col gap-4 px-6 py-12">
            <GateForms onSignedIn={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
