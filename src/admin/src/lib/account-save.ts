import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import type { AdminAccount } from "@/types/admin-account";
import type { AccountField, FlowResult } from "@/services/account-flows";
import { changeReason } from "@/lib/workspace-verbs";
import { saveQuestionReason, type QuestionDraft } from "./account-question";

/* The Accounts one-Save (`55` decision 5): the toolbar's ONE `Save` commits the ENTIRE record - the account fields,
 * then the Security question while its group holds a draft. Pure composition over the two flows, so the order and
 * the partial-failure behaviour are testable without a renderer. */

/** The one Save's two parts, as the workspace wires them: the fields flow, and the question flow (each marked busy
 *  by its own key around the call the flow makes). */
export interface AccountSaveParts {
  readonly fields: () => Promise<FlowResult<AdminAccount | null>>;
  readonly question: (question: number, answer: string) => Promise<FlowResult>;
}

/** Where the one Save stopped. `fields-refused` names the row the fields' refusal sits under; `question-refused`
 *  carries the fields' answer too (they were committed) beside the question's own row. */
export type AccountSaveOutcome =
  | { readonly stage: "dropped" }
  | { readonly stage: "saved"; readonly account: AdminAccount | null }
  | { readonly stage: "fields-refused"; readonly sentence: string; readonly field?: AccountField }
  | { readonly stage: "question-refused"; readonly account: AdminAccount | null; readonly sentence: string; readonly field?: "question" | "answer" };

/** True while the Security question group holds a draft: a question chosen OR an answer typed. */
export function questionHeld(draft: QuestionDraft): boolean {
  return draft.question !== "" || draft.answer.trim() !== "";
}

/** Why the toolbar's ONE Save cannot commit: while the question group holds a draft, the question's own reasons
 *  (they gate the WHOLE Save); else `Nothing has changed.` while the whole record is clean; else the fields' own
 *  reason (a call going, the unreachable sentence). */
export function accountSaveReason(
  fieldsDirty: boolean,
  draft: QuestionDraft,
  busy: boolean,
  unreachable: boolean,
): string | undefined {
  if (questionHeld(draft)) return saveQuestionReason(draft, busy, unreachable);
  return changeReason(fieldsDirty, busy ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined);
}

/** The one Save's press. The fields go first; the question follows only after they succeed and only while its group
 *  holds a draft (an empty draft skips it). The question's value reasons gate the whole press: nothing is sent while
 *  they stand. A fields' refusal stops the press before the question is sent; a question's refusal leaves the fields
 *  saved - the outcome carries their answer so the baseline can move - with the sentence under the question's row. */
export async function saveAccountRecord(parts: AccountSaveParts, draft: QuestionDraft): Promise<AccountSaveOutcome> {
  if (questionHeld(draft)) {
    const gate = saveQuestionReason(draft, false, false);
    if (gate !== undefined) {
      return { stage: "question-refused", account: null, sentence: gate, field: draft.question === "" ? "question" : "answer" };
    }
  }
  const fields = await parts.fields();
  if (!fields.ok) {
    if (fields.dropped === true) return { stage: "dropped" };
    return { stage: "fields-refused", sentence: fields.sentence, ...(fields.field !== undefined && { field: fields.field }) };
  }
  if (!questionHeld(draft)) return { stage: "saved", account: fields.value };
  const asked = await parts.question(Number(draft.question), draft.answer);
  if (!asked.ok) {
    if (asked.dropped === true) return { stage: "dropped" };
    return {
      stage: "question-refused",
      account: fields.value,
      sentence: asked.sentence,
      ...(asked.field !== "question" && asked.field !== "answer" ? {} : { field: asked.field }),
    };
  }
  return { stage: "saved", account: fields.value };
}
