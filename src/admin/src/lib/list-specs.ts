import type { AccountRowView } from "./account-rows";
import { countValue } from "./count-value";
import type { JobRowView } from "./job-rows";
import { byText, type ListSpec } from "./list-query";
import type { PlaylistRowView } from "./playlist-rows";
import type { ProviderRowView } from "./provider-rows";
import type { DeletedRowView } from "./title-restore";

/* What each held index list searches, filters and sorts by (`list-query.ts` runs them): the row text a search looks in,
 * the value each filter compares, and a comparator for each column that sorts (the ids are the table's column ids, so a
 * heading press and the Sort select name the same column). Pure. */

/** `never` for a time that does not exist (`formatWhen`), else the filter's other value. */
const since = (when: string, other: string): string => (when === "never" ? "never" : other);

export const providerSpec: ListSpec<ProviderRowView> = {
  fields: (row) => [row.name, row.source, row.family],
  filters: { state: (row) => row.state.word, family: (row) => row.family },
  sorts: {
    order: (a, b) => Number(a.order) - Number(b.order),
    name: (a, b) => byText(a.name, b.name),
    source: (a, b) => byText(a.source, b.source),
    family: (a, b) => byText(a.family, b.family),
    state: (a, b) => byText(a.state.word, b.state.word),
  },
};

export const playlistSpec: ListSpec<PlaylistRowView> = {
  fields: (row) => [row.name, row.source],
  filters: { state: (row) => row.state.word, "last-run": (row) => since(row.lastRun, "ran") },
  sorts: {
    name: (a, b) => byText(a.name, b.name),
    source: (a, b) => byText(a.source, b.source),
    channels: (a, b) => countValue(a.channels) - countValue(b.channels),
    enabled: (a, b) => countValue(a.enabled) - countValue(b.enabled),
    online: (a, b) => countValue(a.online) - countValue(b.online),
    offline: (a, b) => countValue(a.offline) - countValue(b.offline),
    "last-run": (a, b) => byText(a.lastRun, b.lastRun),
    state: (a, b) => byText(a.state.word, b.state.word),
  },
};

export const jobSpec: ListSpec<JobRowView> = {
  fields: (row) => [row.name, row.type, row.target],
  filters: { type: (row) => row.type, state: (row) => row.state.word },
  sorts: {
    name: (a, b) => byText(a.name, b.name),
    type: (a, b) => byText(a.type, b.type),
    target: (a, b) => byText(a.target, b.target),
    "last-run": (a, b) => byText(a.lastRun, b.lastRun),
    state: (a, b) => byText(a.state.word, b.state.word),
  },
};

export const accountSpec: ListSpec<AccountRowView> = {
  fields: (row) => [row.username],
  filters: { state: (row) => row.state.word, "sign-in": (row) => since(row.when, "signed") },
  sorts: {
    username: (a, b) => byText(a.username, b.username),
    state: (a, b) => byText(a.state.word, b.state.word),
    "last-sign-in": (a, b) => byText(a.when, b.when),
  },
};

/** The deleted titles' columns do not sort: the order is the backend's. */
export const deletedSpec: ListSpec<DeletedRowView> = {
  fields: (row) => [row.name, row.kind],
  filters: { kind: (row) => row.kind },
  sorts: {},
};
