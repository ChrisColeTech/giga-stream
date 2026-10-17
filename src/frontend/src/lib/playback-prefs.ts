import { SUBTITLE_LANGUAGES, SUBTITLE_OFF } from "@/constants/settings-sections";
import type { VideoQuality } from "@/types/settings";

/* The playback preferences' choices (`06` section 3.3). A preference is a standing choice, the way YouTube's quality
 * preference and Netflix's audio and subtitle languages are: it never depends on what is playing. A stream that cannot
 * honor one plays its nearest offer. */

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

export const QUALITY_CHOICES: readonly Choice<VideoQuality>[] = [
  { value: "auto", label: "Auto" },
  { value: "higher", label: "Higher picture quality" },
  { value: "saver", label: "Data saver" },
];

export type LatencyChoice = "normal" | "low";

export const LATENCY_CHOICES: readonly Choice<LatencyChoice>[] = [
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

/** The audio select's value for the stream's own default track. */
export const AUDIO_DEFAULT = "default";

/** Audio: the stream's default, then the languages the subtitle select offers (without its off choice). */
export const AUDIO_CHOICES: readonly Choice<string>[] = [
  { value: AUDIO_DEFAULT, label: "Stream default" },
  ...SUBTITLE_LANGUAGES.filter((language) => language.value !== SUBTITLE_OFF),
];

/** Captions: Off, then the languages. */
export const CAPTION_CHOICES: readonly Choice<string>[] = SUBTITLE_LANGUAGES;

export function qualityOf(value: string): VideoQuality {
  return QUALITY_CHOICES.find((choice) => choice.value === value)?.value ?? "auto";
}

export function latencyOption(lowLatency: boolean): LatencyChoice {
  return lowLatency ? "low" : "normal";
}

export function audioOption(tag: string | null): string {
  return tag ?? AUDIO_DEFAULT;
}

export function audioTag(option: string): string | null {
  return option === AUDIO_DEFAULT ? null : option;
}
