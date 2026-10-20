import {
  REGISTRATION_ANSWER_LONG,
  REGISTRATION_ANSWER_REQUIRED,
  REGISTRATION_PASSWORD_LONG,
  REGISTRATION_PASSWORD_REQUIRED,
  REGISTRATION_QUESTION_REQUIRED,
  REGISTRATION_USERNAME_LONG,
  REGISTRATION_USERNAME_REQUIRED,
  REGISTRATION_WAITING,
} from "@/constants/registration-copy";
import type { RegistrationInput } from "@/types/auth";

export type RegistrationField = "username" | "password" | "securityQuestion" | "securityAnswer" | "form";

export interface RegistrationError {
  readonly field: RegistrationField;
  readonly sentence: string;
}

/** Client-side checks mirror the strict fileserver body limits. Passwords are never trimmed. */
export function registrationError(input: RegistrationInput): RegistrationError | null {
  if (input.username.trim() === "") return { field: "username", sentence: REGISTRATION_USERNAME_REQUIRED };
  if (input.username.trim().length > 254) return { field: "username", sentence: REGISTRATION_USERNAME_LONG };
  if (input.password === "") return { field: "password", sentence: REGISTRATION_PASSWORD_REQUIRED };
  if (input.password.length > 256) return { field: "password", sentence: REGISTRATION_PASSWORD_LONG };
  if (
    input.securityQuestion === null
    || !Number.isInteger(input.securityQuestion)
    || input.securityQuestion < 1
    || input.securityQuestion > 8
  ) {
    return { field: "securityQuestion", sentence: REGISTRATION_QUESTION_REQUIRED };
  }
  if (input.securityAnswer.trim() === "") {
    return { field: "securityAnswer", sentence: REGISTRATION_ANSWER_REQUIRED };
  }
  if (input.securityAnswer.length > 200) {
    return { field: "securityAnswer", sentence: REGISTRATION_ANSWER_LONG };
  }
  return null;
}

export function registrationReason(input: RegistrationInput, busy: boolean): string | undefined {
  if (busy) return REGISTRATION_WAITING;
  return registrationError(input)?.sentence;
}
