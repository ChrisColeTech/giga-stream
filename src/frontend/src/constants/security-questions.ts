export interface SecurityQuestionChoice {
  readonly value: number;
  readonly label: string;
}

/** The fileserver's fixed reset-question vocabulary. Values are the persisted wire ids, not array positions. */
export const SECURITY_QUESTIONS: readonly SecurityQuestionChoice[] = [
  { value: 1, label: "What was the name of your first pet?" },
  { value: 2, label: "In what city were you born?" },
  { value: 3, label: "What was the name of your first school?" },
  { value: 4, label: "What is your mother's maiden name?" },
  { value: 5, label: "What was the make of your first car?" },
  { value: 6, label: "What was the name of the street you grew up on?" },
  { value: 7, label: "What was your childhood nickname?" },
  { value: 8, label: "What is your favourite book?" },
];
