import type { QueryChoice } from "@giga/ui/lists/QuerySelect";
import type { SortState } from "@giga/ui/lists/record-grid-sort";
import { ANY } from "@/lib/list-query";

/* The query row of the index lists the admin holds whole (`45`, `01` section 9): the search field's name, the Sort
 * select's columns (the table's own column ids) and the filter selects, self-labelling like Channels' and Titles'. Copy
 * lives here, never in a component. The FIRST option of a filter is its default, worded for the open list only. */

export type ListId = "providers" | "playlists" | "jobs" | "accounts" | "deleted";

export interface FilterDef {
  /** The key in `ListQuery.filters` and in the list's `ListSpec.filters`. */
  readonly id: string;
  readonly label: string;
  readonly options: readonly QueryChoice<string>[];
}

export interface ListBarDef {
  /** The search field's accessible name and tooltip. */
  readonly search: string;
  /** The Sort select's options; empty when no column of the list sorts (no Sort control is drawn). */
  readonly sorts: readonly QueryChoice<string>[];
  readonly filters: readonly FilterDef[];
}

const choice = (value: string, label: string): QueryChoice<string> => ({ value, label });

const stateFilter = (...words: readonly string[]): FilterDef => ({
  id: "state",
  label: "State",
  options: [choice(ANY, "Any state"), ...words.map((word) => choice(word, word.charAt(0).toUpperCase() + word.slice(1)))],
});

export const LIST_BARS: Readonly<Record<ListId, ListBarDef>> = {
  providers: {
    search: "Search providers",
    sorts: [
      choice("order", "Order"),
      choice("name", "Name"),
      choice("source", "Source"),
      choice("family", "Family"),
      choice("state", "State"),
    ],
    filters: [
      stateFilter("enabled", "disabled"),
      {
        id: "family",
        label: "Family",
        options: [choice(ANY, "Any family"), choice("Embed", "Embed"), choice("Stream", "Stream")],
      },
    ],
  },
  playlists: {
    search: "Search playlists",
    sorts: [
      choice("name", "Name"),
      choice("source", "Source"),
      choice("channels", "Channels"),
      choice("enabled", "Enabled"),
      choice("live", "Live"),
      choice("dead", "Dead"),
      choice("last-run", "Last run"),
      choice("state", "State"),
    ],
    filters: [
      stateFilter("enabled", "disabled"),
      {
        id: "last-run",
        label: "Last run",
        options: [choice(ANY, "Any last run"), choice("ran", "Has run"), choice("never", "Never run")],
      },
    ],
  },
  jobs: {
    search: "Search jobs",
    sorts: [
      choice("name", "Name"),
      choice("type", "Type"),
      choice("target", "Target"),
      choice("last-run", "Last run"),
      choice("state", "State"),
    ],
    filters: [
      {
        id: "type",
        label: "Type",
        options: [choice(ANY, "Any type"), choice("Playlist", "Playlist"), choice("Catalog", "Catalog")],
      },
      stateFilter("running", "idle", "failed", "stopped", "disabled"),
    ],
  },
  accounts: {
    search: "Search accounts",
    sorts: [choice("username", "Username"), choice("state", "State"), choice("last-sign-in", "Last sign-in")],
    filters: [
      stateFilter("enabled", "disabled"),
      {
        id: "sign-in",
        label: "Sign-in",
        options: [choice(ANY, "Any sign-in"), choice("signed", "Has signed in"), choice("never", "Never signed in")],
      },
    ],
  },
  deleted: {
    search: "Search deleted titles",
    sorts: [],
    filters: [
      {
        id: "kind",
        label: "Kind",
        options: [choice(ANY, "Any kind"), choice("Movie", "Movies"), choice("Series", "Series")],
      },
    ],
  },
};

/** Each list's order before anything is chosen: the one the list already kept. Deleted titles keep the backend's (a key
 *  no column has). */
export const LIST_STARTS: Readonly<Record<ListId, SortState>> = {
  providers: { key: "order", dir: "asc" },
  playlists: { key: "name", dir: "asc" },
  jobs: { key: "name", dir: "asc" },
  accounts: { key: "username", dir: "asc" },
  deleted: { key: "", dir: "asc" },
};
