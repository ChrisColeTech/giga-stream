import {
  appendEndlist,
  markDiscontinuityAtStart,
  readSequence,
  setDiscontinuitySequence,
  setSequence,
} from "../stream/playlist-edit.ts";

export const FAULTS = ["stall", "segment-404", "slow-segments", "playlist-500", "discontinuity", "restart", "end"] as const;
export type Fault = (typeof FAULTS)[number];
export const DEFAULT_SLOW_MS = 4000;
export const SEQUENCE_JUMP = 1000;

interface FaultRecord {
  fault: Fault;
  expiresAt: number | null;
  delayMs: number;
  snapshots: Map<string, { body: string; sequence: number }>;
}

/**
 * Per-channel fault switches (docs/10 section 2, item 5), to drive a player's failure treatments. At most
 * one fault is active per channel; setting another replaces it. A fault with `durationMs` clears itself
 * when the clock passes it. `playlist` and `segment` say what a request gets under the active fault.
 */
export function createFaultState(now: () => number = Date.now) {
  const active = new Map<string, FaultRecord>();

  function current(channelId: string): FaultRecord | null {
    const record = active.get(channelId);
    if (record && record.expiresAt !== null && now() >= record.expiresAt) {
      active.delete(channelId);
      return null;
    }
    return record ?? null;
  }

  return {
    set(channelId: string, fault: Fault, durationMs?: number, delayMs?: number): void {
      const expiresAt = durationMs === undefined ? null : now() + durationMs;
      active.set(channelId, { fault, expiresAt, delayMs: delayMs ?? DEFAULT_SLOW_MS, snapshots: new Map() });
    },
    clear: (channelId: string): void => void active.delete(channelId),
    /** The active fault's name and how long it has left, or null. */
    describe(channelId: string): { fault: Fault; expiresInMs: number | null } | null {
      const record = current(channelId);
      if (!record) return null;
      return { fault: record.fault, expiresInMs: record.expiresAt === null ? null : record.expiresAt - now() };
    },
    /** Applies the active fault to a media playlist body; `key` names the playlist for snapshots. */
    playlist(channelId: string, key: string, body: string): { status: 200; body: string } | { status: 500 } {
      const record = current(channelId);
      if (!record) return { status: 200, body };
      const sequence = readSequence(body);
      const snapshot = record.snapshots.get(key) ?? { body, sequence };
      record.snapshots.set(key, snapshot);
      switch (record.fault) {
        case "stall":
          return { status: 200, body: snapshot.body };
        case "playlist-500":
          return { status: 500 };
        case "end":
          return { status: 200, body: appendEndlist(body) };
        case "restart":
          return { status: 200, body: markDiscontinuityAtStart(setSequence(body, Math.max(0, sequence - snapshot.sequence))) };
        case "discontinuity": {
          const jumped = setSequence(body, sequence + SEQUENCE_JUMP);
          return { status: 200, body: markDiscontinuityAtStart(setDiscontinuitySequence(jumped, 1)) };
        }
        default:
          return { status: 200, body };
      }
    },
    /** What to do with a segment request under the active fault. */
    segment(channelId: string): { status: 200 | 404; delayMs: number } {
      const record = current(channelId);
      if (record?.fault === "segment-404") return { status: 404, delayMs: 0 };
      if (record?.fault === "slow-segments") return { status: 200, delayMs: record.delayMs };
      return { status: 200, delayMs: 0 };
    },
  };
}

export type FaultState = ReturnType<typeof createFaultState>;
