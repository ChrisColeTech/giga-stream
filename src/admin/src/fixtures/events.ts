import type { EventRow } from "@/types/events";

/** PHASE 1 FIXTURE: rows of the events drawer. The row shape is decided by the traffic probe (`21` section 9); these rows
 *  are placeholders until the Events owner builds the decided shape. */
export const EVENT_ROWS: readonly EventRow[] = [
  { id: "e-1", at: 1790000000000, tone: "info", area: "Connection", sentence: "Connected to the fileserver." },
  { id: "e-2", at: 1790000012000, tone: "info", area: "Catalog", sentence: "Channels read: 16." },
  { id: "e-3", at: 1790000030000, tone: "warn", area: "Media", sentence: "A stream stopped answering.", identity: "Metro Desk" },
  { id: "e-4", at: 1790000045000, tone: "info", area: "Scan", sentence: "Folder scan finished.", identity: "Films" },
  { id: "e-5", at: 1790000060000, tone: "error", area: "Playback", sentence: "A stream failed to start.", identity: "Pitch One" },
];
