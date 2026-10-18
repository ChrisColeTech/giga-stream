import type { CSSProperties } from "react";
import { labelColumn } from "@giga/ui/lib/label-column";
import { GateBrand } from "@/components/session/GateBrand";
import { GateNotice } from "@/components/session/GateNotice";
import { SignInForm } from "@/components/session/SignInForm";
import { SIGN_IN_LABELS } from "@/constants/sign-in-copy";
import { gateNotice } from "@/lib/gate-state";
import { useAppStore } from "@/store/app-store";

/* The Giga Images wall (`34` section 4): it covers the whole window, titlebar included, because nothing of the shell may
 * show to someone with no account. The shell behind it is inert (`AppShell`). */
const WALL = "fixed inset-0 z-75 flex flex-col bg-bg";

/** The pre-app sign-in wall: the brand column left, the form centred in the rest, a drag strip over the top 40px so the
 *  Electron window can still be moved, and the OS's caption buttons in the top-right corner (the page puts nothing
 *  there). No Escape handler and no way out: a gate has no cancel. It scrolls inside the window when the window is short. */
export function SignInPage() {
  const notice = gateNotice(useAppStore((state) => state.gate));

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign in to Giga Stream Admin" className={WALL}>
      {/* Overlays the columns rather than sitting above them, so the brand column is not pushed down 40px. */}
      <div className="absolute inset-x-0 top-0 z-1 h-10 [-webkit-app-region:drag]" />
      <div className="relative flex min-h-0 flex-1">
        <GateBrand />
        <div className="flex min-w-0 flex-1 overflow-y-auto bg-surface">
          <div
            className="m-auto flex w-full max-w-104 flex-col gap-4 px-6 py-12"
            style={{ "--label-col": labelColumn(SIGN_IN_LABELS) } as CSSProperties}
          >
            {notice !== null && <GateNotice sentence={notice} />}
            <SignInForm />
          </div>
        </div>
      </div>
    </div>
  );
}
