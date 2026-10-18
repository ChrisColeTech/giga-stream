import { firstRefusal, httpsAddress, required, wholeNumber, type Refusal } from "./field-checks";
import type { ChannelDraft } from "./channel-draft";

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
  /** Value refusals: shown under their rows as the person types, and on the notice line if Save is pressed anyway. */
  readonly errors: ChannelErrors;
  /** The first value refusal, in the page's order, or null. */
  readonly refusal: Refusal;
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
  return {
    reason: missing ?? undefined,
    errors,
    refusal: firstRefusal([errors.name, errors.number, errors.folder, errors.streamUrl, errors.logoUrl]),
  };
}
