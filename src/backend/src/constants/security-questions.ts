/**
 * The security-question reset (docs/40 sections 2.1 to 2.5). A fixed picklist, numbered 1 to 8 by position: free
 * text would make a real account's question look different from a decoy and so reveal which emails are accounts.
 */
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

export const SECURITY_QUESTION_COUNT = 8;
/** The longest answer accepted, counted before normalisation. */
export const SECURITY_ANSWER_MAX = 200;
/** Wrong answers in a row that lock the reset for one email, and how long the lock lasts. */
export const RESET_LOCK_FAILURES = 5;
export const RESET_LOCK_MS = 15 * 60 * 1000;
/** The HMAC input prefix of the decoy question an unknown email or a question-less account is shown. */
export const RESET_DECOY_PREFIX = "reset-decoy:";
