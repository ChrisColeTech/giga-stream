import { useEffect, useReducer, type CSSProperties } from "react";
import { KeyRound } from "lucide-react";
import { labelColumn } from "@giga/ui/lib/label-column";
import { GATE_NOTICE_TITLE, SIGN_IN_LABELS } from "@/constants/gate-copy";
import { RESET_LABELS } from "@/constants/reset-copy";
import { useResetPassword } from "@/hooks/useResetPassword";
import { useResetStart } from "@/hooks/useResetStart";
import { gateNotice } from "@/lib/gate-state";
import { nextReset, RESET_START, type ResetNotice } from "@/lib/reset-state";
import { useAppStore } from "@/store/app-store";
import { GateNotice } from "./GateNotice";
import { ResetAnswerForm } from "./ResetAnswerForm";
import { ResetUsernameForm } from "./ResetUsernameForm";
import { SignInForm } from "./SignInForm";

export interface GateFormsProps {
  /** A sign-in was accepted: the session has started, so the dialog around these forms closes and focus returns to
   *  the titlebar control. */
  readonly onSignedIn?: () => void;
}

/** The gate's forms, mounted in the Account dialog (`63` section 3.1): sign in, or the two steps of the password
 *  reset (`40`), all in the same column. A refusal keeps its sentence; a session that ended under the app speaks on
 *  the notice card the next time the dialog opens. */
export function GateForms({ onSignedIn }: GateFormsProps) {
  const signedIn = useAppStore((state) => state.signedIn);
  const gateSentence = gateNotice(useAppStore((state) => state.gate));
  const [reset, dispatch] = useReducer(nextReset, RESET_START);
  const startReset = useResetStart(dispatch);
  const resetPassword = useResetPassword(dispatch);
  const signingIn = reset.view === "signin";
  const gateCard: ResetNotice | null =
    gateSentence === null ? null : { title: GATE_NOTICE_TITLE, sentence: gateSentence };
  const card = signingIn ? (reset.notice ?? gateCard) : reset.notice;

  useEffect(() => {
    if (signedIn) onSignedIn?.();
  }, [signedIn, onSignedIn]);

  return (
    <div
      className="flex w-full flex-col gap-4"
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
  );
}
