import { NAME_LENGTH, NAME_MAX, PAGES_MAX, PAGES_MIN, PLAYLIST_REQUIRED } from "@/constants/job-copy";
import { required, schedule, wholeNumber, type Refusal } from "./field-checks";
import type { JobDraft, NewJobDraft } from "./job-draft";

/* The Jobs rules (`38` sections 4.2 and 4.3), mirroring the backend's so a form refuses before it sends. They use the
 * frozen primitives of `field-checks.ts`. */

/** The rows a refusal can sit under, by the backend's own field names (`config.playlistId` names `playlistId`). `run`
 *  is the workspace's `Run job` control. */
export type JobField = "name" | "playlistId" | "scope" | "kind" | "enabled" | "pages" | "schedule" | "run";

export const JOB_FIELDS: readonly JobField[] = ["name", "playlistId", "scope", "kind", "enabled", "pages", "schedule"];

export interface JobRefusal {
  readonly field: JobField;
  readonly sentence: string;
}

export const nameRefusal = (value: string): Refusal =>
  required("Name", value) ?? (value.trim().length > NAME_MAX ? NAME_LENGTH : null);

/** The interval: required, then a number and `m` or `h`, or `off` (`6h`, `30m`, `24h`, `off` pass; `x` does not). */
export const scheduleRefusal = (value: string): Refusal => required("Interval", value) ?? schedule("Interval", value);

export const pagesRefusal = (value: string): Refusal =>
  required("Pages", value) ?? wholeNumber("Pages", value, PAGES_MIN, PAGES_MAX);

/** Why `Create` is disabled, in the form's order, or undefined: the Name, then a playlist job's Playlist (none to
 *  choose while the list is empty or unread), then the busy or unreachable reason. */
export function createReason(draft: NewJobDraft, playlistId: string, busy: string | undefined): string | undefined {
  return (
    required("Name", draft.name) ?? (draft.type === "playlist" && playlistId === "" ? PLAYLIST_REQUIRED : null) ?? busy
  );
}

export function firstCreateRefusal(draft: NewJobDraft): JobRefusal | null {
  const name = nameRefusal(draft.name);
  return name === null ? null : { field: "name", sentence: name };
}

/** The first value a workspace save refuses, in the page's order, or null. Pages is checked for a catalog job only. */
export function firstSaveRefusal(draft: JobDraft, catalog: boolean): JobRefusal | null {
  const checks: Array<[JobField, Refusal]> = [
    ["name", nameRefusal(draft.name)],
    ["pages", catalog ? pagesRefusal(draft.pages) : null],
    ["schedule", scheduleRefusal(draft.schedule)],
  ];
  const found = checks.find(([, sentence]) => sentence !== null);
  return found === undefined || found[1] === null ? null : { field: found[0], sentence: found[1] };
}
