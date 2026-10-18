import { Clock3, Eye, Film, ListVideo, Plug, Radio, Users, type LucideIcon } from "lucide-react";

/** Where a page-toolbar forward verb goes: `Preview` opens a channel's preview window, the rest switch to that tab. The
 *  name is the verb's `label` in the data that declares it. */
export type ForwardDestination = "Preview" | "Channels" | "Providers" | "Titles" | "Playlists" | "Jobs" | "Accounts";

/** The icon of each forward verb in a page toolbar (`01` section 9: toolbars use icons, one meaningful icon per action as
 *  the interface's toolbars do). One per destination, none repeated, and none shared with a bulk verb. */
export const FORWARD_ICONS: Readonly<Record<ForwardDestination, LucideIcon>> = {
  Preview: Eye,
  Channels: Radio,
  Providers: Plug,
  Titles: Film,
  Playlists: ListVideo,
  Jobs: Clock3,
  Accounts: Users,
};

export const PREVIEW_TOOLTIP = "Preview channel";
export const GO_TO_TOOLTIP = "Go to";

/** The tooltip and `aria-label` of a forward verb: the verb plus where it goes (`Preview channel`, `Go to Titles`). */
export const FORWARD_TOOLTIPS: Readonly<Record<ForwardDestination, string>> = {
  Preview: PREVIEW_TOOLTIP,
  Channels: `${GO_TO_TOOLTIP} Channels`,
  Providers: `${GO_TO_TOOLTIP} Providers`,
  Titles: `${GO_TO_TOOLTIP} Titles`,
  Playlists: `${GO_TO_TOOLTIP} Playlists`,
  Jobs: `${GO_TO_TOOLTIP} Jobs`,
  Accounts: `${GO_TO_TOOLTIP} Accounts`,
};
