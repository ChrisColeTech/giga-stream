import type { DotState } from "@/components/ui/StatusDot";

/** The connection words of the statusbar (`06` section 1.2). */
export type ConnectionWord = "connecting" | "ready" | "reconnecting";

/** PHASE 1 ONLY. The connection the statusbar shows until the fileserver is wired in phase 2. Deleted with
 *  `src/fixtures/`, when the state read sets the real word (`02` section 2.3). */
export const PREVIEW_CONNECTION: ConnectionWord = "ready";

export const CONNECTION_DOT: Readonly<Record<ConnectionWord, DotState>> = {
  connecting: "loading",
  ready: "done",
  reconnecting: "loading",
};
