import { Clapperboard, List, Plug, Plus, Radio, Timer, UserPlus, Users, type LucideIcon } from "lucide-react";
import type { Tab } from "@/types/shell";

/** What an index draws around its list: the two group tiles/titles and the New form's skeleton row count. */
export interface IndexFrame {
  readonly tab: Tab;
  readonly newIcon: LucideIcon;
  readonly newTitle: string;
  readonly listIcon: LucideIcon;
  readonly listTitle: string;
  readonly newRows: number;
}

export const INDEX_FRAMES: Readonly<Record<Tab, IndexFrame>> = {
  channels: {
    tab: "channels",
    newIcon: Plus,
    newTitle: "New channel",
    listIcon: Radio,
    listTitle: "Channels",
    newRows: 5,
  },
  providers: {
    tab: "providers",
    newIcon: Plus,
    newTitle: "New provider",
    listIcon: Plug,
    listTitle: "Providers",
    newRows: 4,
  },
  titles: {
    tab: "titles",
    newIcon: Plus,
    newTitle: "New title",
    listIcon: Clapperboard,
    listTitle: "Titles",
    newRows: 3,
  },
  playlists: {
    tab: "playlists",
    newIcon: Plus,
    newTitle: "New playlist",
    listIcon: List,
    listTitle: "Playlists",
    newRows: 3,
  },
  jobs: {
    tab: "jobs",
    newIcon: Plus,
    newTitle: "New job",
    listIcon: Timer,
    listTitle: "Jobs",
    newRows: 7,
  },
  accounts: {
    tab: "accounts",
    newIcon: UserPlus,
    newTitle: "New account",
    listIcon: Users,
    listTitle: "Accounts",
    newRows: 3,
  },
};
