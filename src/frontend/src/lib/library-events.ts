import type { EventInput } from "@/lib/event-log";

const count = (value: number): string => String(Math.max(0, Math.round(value)));

/** A page was appended: `Library page 12 loaded: 476 of 27020.` (the total is left out when the backend gave none). */
export function libraryPageEvent(page: number, loaded: number, total: number | undefined): EventInput {
  const tail = total === undefined ? `${count(loaded)} titles` : `${count(loaded)} of ${count(total)}`;
  return { tone: "info", area: "Catalog", sentence: `Library page ${count(page)} loaded: ${tail}.` };
}

/** No cursor remains. */
export function libraryEndEvent(titles: number): EventInput {
  return { tone: "info", area: "Catalog", sentence: `Library reached the end: ${count(titles)} titles.` };
}

/** The pager stalled: it wants a page, the list end is in range, and none was requested. */
export function libraryStallEvent(): EventInput {
  return { tone: "warn", area: "Catalog", sentence: "Library paging is waiting but no page was requested." };
}
