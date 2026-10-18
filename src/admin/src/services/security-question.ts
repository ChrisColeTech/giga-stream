import { ApiError } from "@giga/http/api-error";
import { ANSWER_NOT_VALID, WRONG_CURRENT_PASSWORD } from "@/constants/security-question-copy";
import { request } from "./api";
import { QuestionSavedSchema } from "./schemas/reset-schema";

/** Why a save was refused, and the row it sits under: the current password (`401 auth.invalid_credentials`, field
 *  `currentPassword`), the answer or the question (`422 account.invalid`), or nothing to point at (a transport failure,
 *  a server fault), which the caller says on the notice line. */
export interface QuestionRefusal {
  readonly field: "currentPassword" | "answer" | "question" | null;
  readonly sentence: string;
}

export type SaveQuestionResult = { readonly ok: true } | { readonly ok: false; readonly refusal: QuestionRefusal };

const FIELDS: readonly string[] = ["currentPassword", "answer", "question"];

/** Maps a failure to the row it belongs under. Pure. The signed layer is used, so an expired session is refreshed first. */
export function questionRefusalFor(error: unknown): QuestionRefusal {
  if (!(error instanceof ApiError)) return { field: null, sentence: "The request failed." };
  const field = FIELDS.find((one) => one === error.field);
  if (field === "currentPassword") return { field, sentence: WRONG_CURRENT_PASSWORD };
  if (field === "answer") return { field, sentence: error.code === "account.invalid" ? ANSWER_NOT_VALID : error.message };
  if (field === "question") return { field, sentence: error.message };
  return { field: null, sentence: error.message };
}

/** `PUT /api/auth/me/security-question`: sets or replaces the signed-in account's own question. Never rejects. */
export async function saveSecurityQuestion(body: {
  currentPassword: string;
  question: number;
  answer: string;
}): Promise<SaveQuestionResult> {
  try {
    await request("/api/auth/me/security-question", QuestionSavedSchema, { method: "PUT", body, area: "Account" });
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, refusal: questionRefusalFor(error) };
  }
}
