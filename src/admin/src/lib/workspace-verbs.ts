import { NOTHING_CHANGED } from "@/constants/record-copy";
import type { ForwardDestination } from "@/constants/toolbar-icons";

/** One verb of a workspace: where it goes, what it does, and why it cannot be used now. */
export interface ToolbarAction {
  readonly label: ForwardDestination;
  readonly onPress: () => void;
  readonly reason?: string;
}

/** A page's promote whose label is not a forward destination (`Run job`, `55` decisions 1, 2 and 6): the word the
 *  small primary draws, its tooltip at rest, and why it cannot be used now. */
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
