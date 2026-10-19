import {
  CHOOSE_QUESTION_REASON,
  ENTER_ANSWER_REASON,
  QUESTION_STATUS_NOT_SET,
  QUESTION_STATUS_SET,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/account-copy";

/* The workspace's Security question group as pure values (docs/54 section 2). The backend stores the question's
 * number and answers only with the account's `securityQuestionSet` flag, so the group holds a draft, never a record. */

export interface QuestionDraft {
  /** The picklist number as the Select holds it (`""` before a choice). */
  readonly question: string;
  readonly answer: string;
}

export const EMPTY_QUESTION_DRAFT: QuestionDraft = { question: "", answer: "" };

/** `Set` or `Not set`; `Not set` until the account's flag says otherwise. */
export function questionStatus(set: boolean | undefined): string {
  return set === true ? QUESTION_STATUS_SET : QUESTION_STATUS_NOT_SET;
}

/** Why `Save question` is disabled, in the group's order, or undefined: the missing field, a call that is running, an
 *  unreachable backend. */
export function saveQuestionReason(draft: QuestionDraft, busy: boolean, unreachable: boolean): string | undefined {
  if (draft.question === "") return CHOOSE_QUESTION_REASON;
  if (draft.answer.trim() === "") return ENTER_ANSWER_REASON;
  return busy ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined;
}
