import { NOTHING_CHANGED } from "@/constants/record-copy";

/** A page's promote: the operation word, its tooltip at rest, and why it cannot be used now. */
export interface ToolbarVerb {
  readonly label: string;
  readonly tip?: string;
  readonly reason?: string;
  readonly onPress: () => void;
}

/** The toolbar's ONE Save (`55` decision 1): the press and the reason it cannot be used yet. */
export interface SaveVerb {
  readonly onPress: () => void;
  readonly reason?: string;
}

/** Why `Save` and `Discard changes` cannot be used: `Nothing has changed.` while the draft equals its baseline; once
 *  something has changed, the page's own reason (a refused value, a call going), else undefined. */
export function changeReason(dirty: boolean, own?: string): string | undefined {
  return dirty ? own : NOTHING_CHANGED;
}
