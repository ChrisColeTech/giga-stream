/** Where a forward verb goes: `Preview` opens a channel's preview window, the rest switch to that tab. The name is the
 *  verb's `label` in the data that declares it, and the word the page toolbar draws before its `→` (`Titles →`). */
export type ForwardDestination = "Preview" | "Channels" | "Providers" | "Titles" | "Playlists" | "Jobs" | "Accounts";

/** A forward verb is its word and `→`, no icon (`01` section 9 Page toolbar; LoRA Trainer `DatasetsIndex.tsx` 67). */
export const FORWARD_ARROW = "→";

export const PREVIEW_TOOLTIP = "Preview channel";
export const GO_TO_TOOLTIP = "Go to";

/** The tooltip of a forward verb: what it does and where it goes (`Preview channel`, `Go to Titles`). */
export const FORWARD_TOOLTIPS: Readonly<Record<ForwardDestination, string>> = {
  Preview: PREVIEW_TOOLTIP,
  Channels: `${GO_TO_TOOLTIP} Channels`,
  Providers: `${GO_TO_TOOLTIP} Providers`,
  Titles: `${GO_TO_TOOLTIP} Titles`,
  Playlists: `${GO_TO_TOOLTIP} Playlists`,
  Jobs: `${GO_TO_TOOLTIP} Jobs`,
  Accounts: `${GO_TO_TOOLTIP} Accounts`,
};
