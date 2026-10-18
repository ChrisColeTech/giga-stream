import {
  ANSWER_TOO_LONG,
  CHOOSE_QUESTION_REASON,
  ENTER_ANSWER_REASON,
  ENTER_CURRENT_PASSWORD_REASON,
  NOT_SIGNED_IN_REASON,
  QUESTION_SAVING_REASON,
  QUESTION_STATUS_NOT_SET,
  QUESTION_STATUS_SET,
} from "@/constants/security-question-copy";
import { SECURITY_ANSWER_MAX } from "@/constants/security-questions";

/* The Account page's security-question form as pure values (`40` section 4.2). */

export interface QuestionDraft {
  /** The picklist number as the Select holds it (`""` before a choice). */
  readonly question: string;
  readonly answer: string;
  readonly currentPassword: string;
}

export const EMPTY_QUESTION_DRAFT: QuestionDraft = { question: "", answer: "", currentPassword: "" };

/** `Set` or `Not set`; unknown (null) until the session says. */
export function questionStatus(set: boolean | undefined): string {
  return set === true ? QUESTION_STATUS_SET : QUESTION_STATUS_NOT_SET;
}

/** Why `Save question` is disabled, in the form's order, or undefined: signed out, the missing field, a running call. */
export function saveQuestionReason(draft: QuestionDraft, signedIn: boolean, busy: boolean): string | undefined {
  if (!signedIn) return NOT_SIGNED_IN_REASON;
  if (draft.question === "") return CHOOSE_QUESTION_REASON;
  if (draft.answer.trim() === "") return ENTER_ANSWER_REASON;
  if (draft.currentPassword === "") return ENTER_CURRENT_PASSWORD_REASON;
  return busy ? QUESTION_SAVING_REASON : undefined;
}

/** The page's own check of the answer before anything is sent. */
export function answerRefusal(answer: string): string | null {
  return answer.length > SECURITY_ANSWER_MAX ? ANSWER_TOO_LONG : null;
}

/** The body of `PUT /api/auth/me/security-question`. The answer goes as typed; the backend normalises it. */
export function questionBody(draft: QuestionDraft): { currentPassword: string; question: number; answer: string } {
  return { currentPassword: draft.currentPassword, question: Number(draft.question), answer: draft.answer };
}
