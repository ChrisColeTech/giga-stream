import { editedTip } from "@/constants/title-copy";
import { TICK_FIRST, TICK_ONE } from "@/constants/record-copy";
import { TITLE_NOT_PREVIEWABLE, UNREACHABLE_REASON } from "@/constants/title-copy";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { titleState, type RowState } from "./row-state";

/* The titles list as pure data: the row a list draws, its state word (and the `edited` tip naming the fields), the
 * ticks and the select-all state. The order is the backend's (the sort is the server's). No React, no store. */

export const isManualTitle = (title: Pick<AdminTitleRow, "state">): boolean => title.state === "manual";

export const isEnabledTitle = (title: Pick<AdminTitleRow, "enabled">): boolean => title.enabled !== false;

export function titlePreviewReason(
  count: number,
  title: AdminTitleRow | undefined,
  unreachable: boolean,
): string | undefined {
  if (count === 0) return TICK_FIRST;
  if (count > 1) return TICK_ONE;
  if (title?.tmdbId === undefined || title.deleted === true || title.stored === false) return TITLE_NOT_PREVIEWABLE;
  return unreachable ? UNREACHABLE_REASON : undefined;
}

export const titleStateOf = (title: AdminTitleRow): RowState =>
  titleState({ enabled: isEnabledTitle(title), manual: isManualTitle(title), edited: title.state === "edited" });

/** A write's answer put into the list: replaces the row with that id in place, or adds it at the top. */
export function upsertTitle(items: readonly AdminTitleRow[], title: AdminTitleRow): AdminTitleRow[] {
  return items.some((item) => item.id === title.id)
    ? items.map((item) => (item.id === title.id ? title : item))
    : [title, ...items];
}

export const withoutTitle = (items: readonly AdminTitleRow[], id: string): AdminTitleRow[] =>
  items.filter((item) => item.id !== id);

export const findTitle = (items: readonly AdminTitleRow[], id: string): AdminTitleRow | undefined =>
  items.find((item) => item.id === id);

/** Only the ticks of rows still on the page: a search, a page or a kind or sort change drops the others. */
export const pruneTitleTicks = (ticked: readonly string[], items: readonly AdminTitleRow[]): string[] =>
  ticked.filter((id) => items.some((item) => item.id === id));

export function titleSelectAll(items: readonly AdminTitleRow[], ticked: readonly string[]): boolean | "mixed" {
  const count = items.filter((item) => ticked.includes(item.id)).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

export interface TitleRowView {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly year: string;
  readonly rating: string;
  readonly state: RowState;
  /** `edited: plot, cast` on an edited title; undefined otherwise. */
  readonly stateTip: string | undefined;
  readonly manual: boolean;
}

export function titleRow(title: AdminTitleRow): TitleRowView {
  const state = titleStateOf(title);
  const fields = title.editedFields ?? [];
  return {
    id: title.id,
    title: title.title,
    kind: title.kind === "movie" ? "Movie" : "Series",
    year: title.year === undefined ? "" : String(title.year),
    rating: title.rating === undefined ? "" : title.rating.toFixed(1),
    state,
    stateTip: state.word === "edited" && fields.length > 0 ? editedTip(fields) : undefined,
    manual: isManualTitle(title),
  };
}
