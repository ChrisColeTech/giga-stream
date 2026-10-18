import { useReducer, type CSSProperties } from "react";
import { KeyRound } from "lucide-react";
import { labelColumn } from "@giga/ui/lib/label-column";
import { GateBrand } from "@/components/session/GateBrand";
import { GateNotice } from "@/components/session/GateNotice";
import { ResetAnswerForm } from "@/components/session/ResetAnswerForm";
import { ResetUsernameForm } from "@/components/session/ResetUsernameForm";
import { SignInForm } from "@/components/session/SignInForm";
import { RESET_LABELS } from "@/constants/reset-copy";
import { GATE_NOTICE_TITLE, SIGN_IN_LABELS } from "@/constants/sign-in-copy";
import { useResetPassword } from "@/hooks/useResetPassword";
import { useResetStart } from "@/hooks/useResetStart";
import { gateNotice } from "@/lib/gate-state";
import { nextReset, RESET_START, type ResetNotice } from "@/lib/reset-state";
import { useAppStore } from "@/store/app-store";

/* The Giga Images wall (`34` section 4): it covers the whole window, titlebar included, because nothing of the shell may
 * show to someone with no account. The shell behind it is inert (`AppShell`). */
const WALL = "fixed inset-0 z-75 flex flex-col bg-bg";

/** The pre-app sign-in wall: the brand column left, the form centred in the rest, a drag strip over the top 40px so the
 *  Electron window can still be moved, and the OS's caption buttons in the top-right corner (the page puts nothing
 *  there). The form column holds one of three views: sign in, or the two steps of the password reset (`40`), all in the
 *  same wall. No Escape handler and no way out: a gate has no cancel. It scrolls inside the window when the window is
 *  short. */
export function SignInPage() {
  const gateSentence = gateNotice(useAppStore((state) => state.gate));
  const [reset, dispatch] = useReducer(nextReset, RESET_START);
  const startReset = useResetStart(dispatch);
  const resetPassword = useResetPassword(dispatch);
  const signingIn = reset.view === "signin";
  const gateCard: ResetNotice | null =
    gateSentence === null ? null : { title: GATE_NOTICE_TITLE, sentence: gateSentence };
  const card = signingIn ? (reset.notice ?? gateCard) : reset.notice;

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign in to Giga Stream Admin" className={WALL}>
      {/* Overlays the columns rather than sitting above them, so the brand column is not pushed down 40px. */}
      <div className="absolute inset-x-0 top-0 z-1 h-10 [-webkit-app-region:drag]" />
      <div className="relative flex min-h-0 flex-1">
        <GateBrand />
        <div className="flex min-w-0 flex-1 overflow-y-auto bg-surface">
          <div
            className="m-auto flex w-full max-w-104 flex-col gap-4 px-6 py-12"
            style={{ "--label-col": labelColumn(signingIn ? SIGN_IN_LABELS : RESET_LABELS) } as CSSProperties}
          >
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
          </div>
        </div>
      </div>
    </div>
  );
}
