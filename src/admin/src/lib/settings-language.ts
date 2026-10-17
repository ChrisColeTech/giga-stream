import { SUBTITLE_OFF } from "@/constants/settings-sections";

/** The subtitle select's value for a stored language: the off choice stands for `null`. */
export function languageOption(tag: string | null): string {
  return tag ?? SUBTITLE_OFF;
}

/** The stored language for a select's value: the off choice is `null`, any other value is its BCP-47 tag. */
export function languageTag(option: string): string | null {
  return option === SUBTITLE_OFF ? null : option;
}
