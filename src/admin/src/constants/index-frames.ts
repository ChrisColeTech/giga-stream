import { Clapperboard, List, Plug, Plus, Radio, Timer, UserPlus, Users, type LucideIcon } from "lucide-react";
import { TICK_FIRST } from "@/constants/record-copy";
import type { ForwardDestination } from "@/constants/toolbar-icons";
import type { Tab } from "@/types/shell";

/** An index's forward verb (`28` section 7.2): an arrow icon in the toolbar strip, its label the tooltip. `to` switches to that tab; `reason` is why it
 *  cannot be used yet (a verb on the ticked rows, with no row to tick). */
export interface ForwardVerb {
  readonly label: ForwardDestination;
  readonly to?: Tab;
  readonly reason?: string;
}

/** What an index draws around its list: the two groups' tiles and titles, how many rows its New form has (the required
 *  fields of `28` section 7.3) and its forward verb. The pages' own forms and grids replace the skeleton in Waves 3 to 5. */
export interface IndexFrame {
  readonly tab: Tab;
  readonly newIcon: LucideIcon;
  readonly newTitle: string;
  readonly listIcon: LucideIcon;
  readonly listTitle: string;
  readonly newRows: number;
  readonly forward: ForwardVerb | null;
}

export const INDEX_FRAMES: Readonly<Record<Tab, IndexFrame>> = {
  channels: {
    tab: "channels",
    newIcon: Plus,
    newTitle: "New channel",
    listIcon: Radio,
    listTitle: "Channels",
    newRows: 5,
    forward: { label: "Preview", reason: TICK_FIRST },
  },
  providers: {
    tab: "providers",
    newIcon: Plus,
    newTitle: "New provider",
    listIcon: Plug,
    listTitle: "Providers",
    newRows: 4,
    forward: { label: "Titles", to: "titles" },
  },
  titles: {
    tab: "titles",
    newIcon: Plus,
    newTitle: "New title",
    listIcon: Clapperboard,
    listTitle: "Titles",
    newRows: 3,
    forward: { label: "Jobs", to: "jobs" },
  },
  playlists: {
    tab: "playlists",
    newIcon: Plus,
    newTitle: "New playlist",
    listIcon: List,
    listTitle: "Playlists",
    newRows: 2,
    forward: { label: "Jobs", to: "jobs" },
  },
  jobs: {
    tab: "jobs",
    newIcon: Plus,
    newTitle: "New job",
    listIcon: Timer,
    listTitle: "Jobs",
    newRows: 3,
    forward: null,
  },
  accounts: {
    tab: "accounts",
    newIcon: UserPlus,
    newTitle: "New account",
    listIcon: Users,
    listTitle: "Accounts",
    newRows: 3,
    forward: null,
  },
};
