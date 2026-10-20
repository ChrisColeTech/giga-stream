import { useReducer, type CSSProperties } from "react";
import { KeyRound } from "lucide-react";
import { labelColumn } from "@giga/ui/lib/label-column";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { GATE_NOTICE_TITLE, SIGN_IN_LABELS } from "@/constants/gate-copy";
import { RESET_LABELS } from "@/constants/reset-copy";
import { useResetPassword } from "@/hooks/useResetPassword";
import { useResetStart } from "@/hooks/useResetStart";
import { gateNotice, offersOfflineEscape } from "@/lib/gate-state";
import { nextReset, RESET_START, type ResetNotice } from "@/lib/reset-state";
import { onDesktopRuntime } from "@/services/persistence";
import { useAppStore } from "@/store/app-store";
import { GateBrand } from "./GateBrand";
import { GateNotice } from "./GateNotice";
import { OfflineEscape } from "./OfflineEscape";
import { ResetAnswerForm } from "./ResetAnswerForm";
import { ResetUsernameForm } from "./ResetUsernameForm";
import { SignInForm } from "./SignInForm";

/* The Giga Images wall (`34` section 4): it covers the whole window, titlebar included, because nothing of the app may
 * show to someone with no session (`62` section 3.5). The shell is not mounted behind it at all. */
const WALL = "fixed inset-0 z-75 flex flex-col bg-bg";

/** The app's gate: the sign-in wall shown instead of the three surfaces while no session is held and the desktop has
 *  not gone offline. The boot's restore probe holds it as a skeleton, so a restored session never flashes the form.
 *  The form column holds one of three views - sign in, or the two steps of the password reset (`40`) - all in the same
 *  wall; the desktop alone is offered `Continue offline`, today's local-only behaviour. No Escape handler and no way
 *  out: a gate has no cancel. It scrolls inside the window when the window is short. */
export function SignInGate() {
  const restoring = useAppStore((state) => state.restoring);
  const gateSentence = gateNotice(useAppStore((state) => state.gate));
  const [reset, dispatch] = useReducer(nextReset, RESET_START);
  const startReset = useResetStart(dispatch);
  const resetPassword = useResetPassword(dispatch);
  const signingIn = reset.view === "signin";
  const offline = offersOfflineEscape(onDesktopRuntime() ? "electron" : "browser") && signingIn && !restoring;
  const gateCard: ResetNotice | null =
    gateSentence === null ? null : { title: GATE_NOTICE_TITLE, sentence: gateSentence };
  const card = signingIn ? (reset.notice ?? gateCard) : reset.notice;

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign in to Giga Stream" className={WALL}>
      {/* Overlays the columns rather than sitting above them, so the brand column is not pushed down 40px. */}
      <div className="absolute inset-x-0 top-0 z-1 h-10 [-webkit-app-region:drag]" />
      <div className="relative flex min-h-0 flex-1">
        <GateBrand />
        <div className="flex min-w-0 flex-1 overflow-y-auto bg-surface">
          <div
            className="m-auto flex w-full max-w-104 flex-col gap-4 px-6 py-12"
            style={{ "--label-col": labelColumn(signingIn ? SIGN_IN_LABELS : RESET_LABELS) } as CSSProperties}
          >
            {restoring ? (
              <div data-restoring aria-busy="true">
                <span className={`${SHIMMER} h-9 w-full`} />
                <span className={`${SHIMMER} mt-4 h-9 w-full`} />
                <span className={`${SHIMMER} mt-4 h-9 w-32`} />
              </div>
            ) : (
              <>
                {card !== null && (
                  <GateNotice
                    sentence={card.sentence}
                    title={card.title}
                    icon={reset.notice === null ? undefined : KeyRound}
                  />
                )}
                {signingIn && (
                  <SignInForm
                    initialUsername={reset.username}
                    onForgot={(username) => dispatch({ type: "forgot", username })}
                  />
                )}
                {reset.view === "reset-username" && (
                  <ResetUsernameForm
                    initialUsername={reset.username}
                    busy={reset.busy}
                    onContinue={(username) => void startReset(username)}
                    onBack={(username) => dispatch({ type: "back", username })}
                  />
                )}
                {reset.view === "reset-answer" && (
                  <ResetAnswerForm
                    state={reset}
                    onReset={(answer, newPassword) => resetPassword(reset.username, answer, newPassword)}
                    onBack={() => dispatch({ type: "back" })}
                  />
                )}
                {offline && <OfflineEscape />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
