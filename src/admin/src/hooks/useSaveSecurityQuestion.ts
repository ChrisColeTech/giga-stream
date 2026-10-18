import { useCallback, useRef, useState } from "react";
import { QUESTION_SAVED } from "@/constants/security-question-copy";
import { answerRefusal, questionBody, type QuestionDraft } from "@/lib/security-question-form";
import { saveSecurityQuestion, type QuestionRefusal } from "@/services/security-question";
import { useAppStore } from "@/store/app-store";

export interface SaveSecurityQuestion {
  /** A call is running: the verb says `Saving.` and a second press sends nothing. */
  readonly busy: boolean;
  /** Sends the draft. Answers null when it saved (the notice line says so and the actor now has a question), or the
   *  refusal and the row it sits under. A stale answer (the session changed while it ran) is dropped: null, silent. */
  readonly save: (draft: QuestionDraft) => Promise<QuestionRefusal | null>;
}

/** The Save question verb: checks the answer's length, awaits `PUT /api/auth/me/security-question` and records the
 *  result. It signs nothing out (a question is not a credential). A failure with no row is said on the notice line. */
export function useSaveSecurityQuestion(): SaveSecurityQuestion {
  const say = useAppStore((state) => state.say);
  const updateActor = useAppStore((state) => state.updateActor);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const save = useCallback(
    async (draft: QuestionDraft): Promise<QuestionRefusal | null> => {
      if (running.current) return null;
      const tooLong = answerRefusal(draft.answer);
      if (tooLong !== null) return { field: "answer", sentence: tooLong };
      const serial = useAppStore.getState().serial;
      running.current = true;
      setBusy(true);
      const result = await saveSecurityQuestion(questionBody(draft));
      running.current = false;
      setBusy(false);
      const state = useAppStore.getState();
      if (!state.signedIn || state.serial !== serial || state.actor === null) return null;
      if (result.ok) {
        updateActor({ ...state.actor, securityQuestionSet: true });
        say(QUESTION_SAVED, "info", "Account");
        return null;
      }
      if (result.refusal.field === null) say(result.refusal.sentence, "warn", "Account");
      return result.refusal;
    },
    [say, updateActor],
  );

  return { busy, save };
}
