import { deleteQuestion } from "@/constants/playlist-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { formatWhen } from "./format-when";
import { enabledState, type RowState } from "./row-state";

/* A list of records with number ids as pure data (playlists and jobs share these): the order the backend keeps, a
 * write's answer put in place, the ticks that still name a row, the select-all tick. Then the playlist row a list draws. */

interface Keyed {
  readonly id: number;
}

/** The answer of a write put into the list: it replaces the record with that id in place, or joins the end. */
export function upsertById<T extends Keyed>(items: readonly T[], record: T): T[] {
  return items.some((item) => item.id === record.id)
    ? items.map((item) => (item.id === record.id ? record : item))
    : [...items, record];
}

export const withoutId = <T extends Keyed>(items: readonly T[], id: number): T[] =>
  items.filter((item) => item.id !== id);

export const findById = <T extends Keyed>(items: readonly T[], id: number): T | undefined =>
  items.find((item) => item.id === id);

/** Only the ticks that still name a row of the list: a row that goes takes its tick with it. */
export const pruneIds = (ticked: readonly number[], items: readonly Keyed[]): number[] =>
  ticked.filter((id) => items.some((item) => item.id === id));

/** One tick on or off; a tick is never held twice. */
export function withTick(ticked: readonly number[], id: number, on: boolean): number[] {
  const rest = ticked.filter((one) => one !== id);
  return on ? [...rest, id] : rest;
}

/** The ticked records in list order. */
export const tickedOf = <T extends Keyed>(items: readonly T[], ticked: readonly number[]): T[] =>
  items.filter((item) => ticked.includes(item.id));

/** The header's select-all tick: `mixed` over a part of the list. An empty list is unticked. */
export function selectAll(items: readonly Keyed[], ticked: readonly number[]): boolean | "mixed" {
  const count = tickedOf(items, ticked).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

/** A record id as a workspace holds it (the store keeps ids as text): null when the text is not one. */
export function idOf(text: string): number | null {
  const id = Number(text);
  return Number.isInteger(id) ? id : null;
}

/** Where a playlist came from, as the list and the workspace show it: a web playlist's masked address, a file
 *  playlist's file name. The address itself is never shown. */
export const sourceOf = (playlist: AdminPlaylist): string =>
  playlist.kind === "file" ? (playlist.fileName ?? playlist.name) : (playlist.masked ?? playlist.host ?? "");

const num = (value: number): string => value.toLocaleString("en-US");

export interface PlaylistRowView {
  readonly id: number;
  readonly name: string;
  readonly source: string;
  readonly channels: string;
  /** How many of its channels are enabled. */
  readonly enabled: string;
  readonly live: string;
  readonly dead: string;
  /** `YYYY-MM-DD HH:mm`, or `never`. */
  readonly lastRun: string;
  readonly state: RowState;
  /** The armed Delete's question: the channels go with the playlist. */
  readonly deleteQuestion: string;
}

export function playlistRow(playlist: AdminPlaylist): PlaylistRowView {
  return {
    id: playlist.id,
    name: playlist.name,
    source: sourceOf(playlist),
    channels: num(playlist.channels),
    enabled: num(playlist.enabledChannels),
    live: num(playlist.live),
    dead: num(playlist.dead),
    lastRun: formatWhen(playlist.lastRunAt),
    state: enabledState(playlist.enabled),
    deleteQuestion: deleteQuestion(playlist.name, playlist.channels),
  };
}
