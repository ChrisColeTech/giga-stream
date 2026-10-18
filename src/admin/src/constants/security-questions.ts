/* The eight security questions, mirrored from the backend's `constants/security-questions.ts` (`40` section 2.1). The
 * number is the position plus one; the backend stores the number, so the order must never change. */
export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was the make of your first car?",
  "What was the name of the street you grew up on?",
  "What was your childhood nickname?",
  "What is your favourite book?",
] as const;

/** The longest answer the backend accepts, counted before it normalises it. */
export const SECURITY_ANSWER_MAX = 200;

/** The picklist as the Select draws it: the number the backend takes, and the words. */
export const SECURITY_QUESTION_OPTIONS: ReadonlyArray<{ readonly value: number; readonly label: string }> =
  SECURITY_QUESTIONS.map((label, index) => ({ value: index + 1, label }));
