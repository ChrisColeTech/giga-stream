import type { CSSProperties } from "react";
import { labelColumn } from "@giga/ui/lib/label-column";
import { GateBrand } from "@/components/session/GateBrand";
import { GateNotice } from "@/components/session/GateNotice";
import { SignInForm } from "@/components/session/SignInForm";
import { SIGN_IN_LABELS } from "@/constants/sign-in-copy";
import { gateNotice } from "@/lib/gate-state";
import { useAppStore } from "@/store/app-store";

/** The gate: the page in the centre of the shell, not a wall over it (`34` section 4). The titlebar and the statusbar
 *  stay and the tabs sleep with `Sign in first`. The Giga Images gate's two columns: the brand left, the form centred in
 *  the rest, scrolling inside the shell when the window is short. */
export function SignInPage() {
  const notice = gateNotice(useAppStore((state) => state.gate));

  return (
    <div role="region" aria-label="Admin sign in" className="flex min-h-0 flex-1 bg-surface">
      <GateBrand />
      <div className="flex min-w-0 flex-1 overflow-y-auto">
        <div
          className="m-auto flex w-full max-w-104 flex-col gap-4 px-6 py-8"
          style={{ "--label-col": labelColumn(SIGN_IN_LABELS) } as CSSProperties}
        >
          {notice !== null && <GateNotice sentence={notice} />}
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
