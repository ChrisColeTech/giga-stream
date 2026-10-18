import { SAVING_REASON, UNREACHABLE_REASON, WORKING_REASON } from "@/constants/channel-copy";
import type { NewChannelDraft } from "./channel-body";
import type { ChannelDraft } from "./channel-draft";
import { firstRefusal, httpsAddress, required, wholeNumber, type Refusal } from "./field-checks";

/** The rows a refusal can sit under, the page's or the backend's (`details.field`). */
export type ChannelField = "name" | "number" | "category" | "folder" | "videos" | "streamUrl" | "logoUrl" | "enabled";

/** The refusals a workspace shows under their rows, by field. A field that passes has none. */
export interface ChannelErrors {
  readonly name: Refusal;
  readonly number: Refusal;
  readonly folder: Refusal;
  readonly streamUrl: Refusal;
  readonly logoUrl: Refusal;
}

export interface ChannelCheck {
  /** Why Save cannot be pressed: the first required field that is empty (`<Label> is required.`); undefined when none. */
  readonly reason: string | undefined;
  /** Value refusals: shown under their rows after Save is pressed, and on the notice line. */
  readonly errors: ChannelErrors;
  /** The first value refusal, in the page's order, with its field, or null. */
  readonly refusal: { readonly field: ChannelField; readonly sentence: string } | null;
}

/** The required fields in the order a person decides them (`28` section 7.3), as `[label, value]`. */
function requiredFields(draft: ChannelDraft): ReadonlyArray<readonly [string, string]> {
  if (draft.kind === "live") {
    const source = draft.plays === "folder" ? (["Folder", draft.folder] as const) : (["Videos", draft.videos.join("")] as const);
    return [["Name", draft.name], ["Number", draft.number], source];
  }
  return [
    ["Name", draft.name],
    ["Number", draft.number],
    ["Category", draft.category],
    ["Stream address", draft.streamUrl],
  ];
}

const firstOf = (errors: ChannelErrors): ChannelCheck["refusal"] => {
  for (const field of ["name", "number", "folder", "streamUrl", "logoUrl"] as const) {
    const sentence = errors[field];
    if (sentence !== null) return { field, sentence };
  }
  return null;
};

/** A workspace's checks: required fields disable Save with the first missing one's reason (the template's model), value
 *  rules (a number outside 1 to 9999, an address that is not https) refuse after the press and show under their row. */
export function checkChannel(draft: ChannelDraft): ChannelCheck {
  const missing = firstRefusal(requiredFields(draft).map(([label, value]) => required(label, value)));
  const errors: ChannelErrors = {
    name: null,
    number: wholeNumber("Number", draft.number),
    folder: null,
    streamUrl: draft.kind === "stream" ? httpsAddress("Stream address", draft.streamUrl) : null,
    logoUrl: draft.kind === "stream" ? httpsAddress("Logo address", draft.logoUrl) : null,
  };
  return { reason: missing ?? undefined, errors, refusal: firstOf(errors) };
}

/** The New form's required rows, in order: the rows its kind does not use are not rendered and are not required. */
function newRequired(draft: NewChannelDraft): ReadonlyArray<readonly [string, string]> {
  const source = draft.kind === "live" ? (["Folder", draft.folder] as const) : (["Stream address", draft.streamUrl] as const);
  return [["Name", draft.name], ["Number", draft.number], ["Category", draft.category], source];
}

export interface WriteState {
  readonly saving: boolean;
  readonly unreachable: boolean;
  /** A bulk run is going on this tab. */
  readonly working?: boolean;
}

/** Why a write cannot start now, before any field reason: a call running, a bulk run, the backend unreachable. */
export function writeReason(state: WriteState): string | undefined {
  if (state.saving) return SAVING_REASON;
  if (state.working === true) return WORKING_REASON;
  return state.unreachable ? UNREACHABLE_REASON : undefined;
}

/** Why `Create` is disabled: the first empty required row (`<Label> is required.`), then the write state. */
export function createReason(draft: NewChannelDraft, state: WriteState): string | undefined {
  return firstRefusal(newRequired(draft).map(([label, value]) => required(label, value))) ?? writeReason(state);
}

/** The New form's value refusals after the press, with the row each goes under, or null. */
export function newChannelRefusal(draft: NewChannelDraft): { field: ChannelField; sentence: string } | null {
  const number = wholeNumber("Number", draft.number);
  if (number !== null) return { field: "number", sentence: number };
  const address = draft.kind === "stream" ? httpsAddress("Stream address", draft.streamUrl) : null;
  return address === null ? null : { field: "streamUrl", sentence: address };
}

const FIELDS: Readonly<Record<string, ChannelField>> = {
  name: "name",
  number: "number",
  category: "category",
  folder: "folder",
  streamUrl: "streamUrl",
  logoUrl: "logoUrl",
  enabled: "enabled",
};

/** The row a backend refusal's `details.field` goes under: `videos.<n>` is the Videos list; a field the form has no row
 *  for (`kind`, `source`, `id`) is notice-only. */
export function channelField(field: string | undefined): ChannelField | undefined {
  if (field === undefined) return undefined;
  if (field === "videos" || field.startsWith("videos.")) return "videos";
  return Object.hasOwn(FIELDS, field) ? FIELDS[field] : undefined;
}
