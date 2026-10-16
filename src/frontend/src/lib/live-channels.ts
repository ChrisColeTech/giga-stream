import type { Channel, ChannelCategory } from "@/types/channel";
import { ALL_CATEGORY, ALL_CATEGORY_LABEL } from "./live-constants";

/** One option of the category select: the label, and the count shown in brackets. */
export interface CategoryOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/** The channels whose name contains the query (case-insensitive, trimmed) in the chosen category. Published order is kept. */
export function filterChannels(items: readonly Channel[], query: string, category: string): readonly Channel[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (channel) =>
      (category === ALL_CATEGORY || channel.category === category) &&
      channel.name.toLowerCase().includes(needle),
  );
}

/** The category select's options: All first with the total, then each published category with its count. A category
 *  that is selected but no longer published stays listed at zero, so the select never loses its own value. */
export function categoryOptions(
  categories: readonly ChannelCategory[],
  selected: string,
  total: number,
): readonly CategoryOption[] {
  const options: CategoryOption[] = [
    { value: ALL_CATEGORY, label: ALL_CATEGORY_LABEL, count: total },
    ...categories.map((category) => ({ value: category.value, label: category.value, count: category.count })),
  ];
  const kept = selected === ALL_CATEGORY || categories.some((category) => category.value === selected);
  if (!kept) options.push({ value: selected, label: selected, count: 0 });
  return options;
}

/** The one tab stop of the list: the selected row when it is listed, otherwise the first listed row. */
export function tabStopId(ids: readonly string[], selectedId: string | null): string | null {
  if (selectedId !== null && ids.includes(selectedId)) return selectedId;
  return ids[0] ?? null;
}

/** The row Up, Down, Home or End moves the selection to. Null when the key is not one of those or no row is listed, so
 *  the caller leaves every other key alone. Moving past either end stays on the end row. */
export function keyTarget(ids: readonly string[], selectedId: string | null, key: string): string | null {
  if (ids.length === 0) return null;
  const at = selectedId === null ? -1 : ids.indexOf(selectedId);
  const last = ids.length - 1;
  switch (key) {
    case "ArrowDown":
      return ids[at < 0 ? 0 : Math.min(at + 1, last)] ?? null;
    case "ArrowUp":
      return ids[at < 0 ? 0 : Math.max(at - 1, 0)] ?? null;
    case "Home":
      return ids[0] ?? null;
    case "End":
      return ids[last] ?? null;
    default:
      return null;
  }
}
