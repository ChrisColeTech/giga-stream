import {
  appendEndlist,
  markDiscontinuityAtStart,
  readSequence,
  setDiscontinuitySequence,
  setSequence,
} from "./playlist-edit.mjs";

export const FAULTS = ["stall", "segment-404", "slow-segments", "playlist-500", "discontinuity", "restart", "end"];
export const DEFAULT_SLOW_MS = 4000;
export const SEQUENCE_JUMP = 1000;

function positiveNumber(value, name) {
  if (value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`fault.invalid: ${name}`);
  return value;
}

/**
 * Per-channel fault switches (docs/10 section 2 item 4). At most one fault is active per channel;
 * setting another replaces it. A fault with `durationMs` clears itself when the clock passes it.
 * The decision methods are pure over the active record, so the HTTP layer only asks and obeys:
 * `playlist` returns { status, body } for a media playlist, `segment` returns { status, delayMs }.
 */
export function createFaultState({ now = Date.now } = {}) {
  const active = new Map();

  function current(channelId) {
    const record = active.get(channelId);
    if (record && record.expiresAt !== null && now() >= record.expiresAt) {
      active.delete(channelId);
      return null;
    }
    return record ?? null;
  }

  return {
    set(channelId, { fault, durationMs, delayMs } = {}) {
      if (fault === "clear") {
        active.delete(channelId);
        return null;
      }
      if (!FAULTS.includes(fault)) throw new Error(`fault.invalid: unknown fault "${String(fault)}"`);
      const duration = positiveNumber(durationMs, "durationMs");
      const record = {
        fault,
        since: now(),
        expiresAt: duration === null ? null : now() + duration,
        delayMs: positiveNumber(delayMs, "delayMs") ?? DEFAULT_SLOW_MS,
        snapshots: new Map(),
      };
      active.set(channelId, record);
      return record;
    },
    clear(channelId) {
      active.delete(channelId);
    },
    active: current,
    /** { fault, expiresInMs } or null: what channels.json reports. */
    describe(channelId) {
      const record = current(channelId);
      if (!record) return null;
      return { fault: record.fault, expiresInMs: record.expiresAt === null ? null : record.expiresAt - now() };
    },
    /** Applies the active fault to a media playlist body; `key` names the playlist for snapshots. */
    playlist(channelId, key, body) {
      const record = current(channelId);
      if (!record) return { status: 200, body };
      const sequence = readSequence(body);
      if (!record.snapshots.has(key)) record.snapshots.set(key, { body, sequence });
      const snapshot = record.snapshots.get(key);
      switch (record.fault) {
        case "stall":
          return { status: 200, body: snapshot.body };
        case "playlist-500":
          return { status: 500, body: null };
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
    segment(channelId) {
      const record = current(channelId);
      if (record?.fault === "segment-404") return { status: 404, delayMs: 0 };
      if (record?.fault === "slow-segments") return { status: 200, delayMs: record.delayMs };
      return { status: 200, delayMs: 0 };
    },
  };
}
