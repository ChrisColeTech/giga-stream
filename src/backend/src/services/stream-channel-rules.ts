import { AppError, ERRORS } from "../constants/errors.js";
import { CHANNEL_NUMBER_MAX } from "../constants/limits.js";
import { NOT_SYNCED, type StreamRecord } from "../types/channel.js";
import type { ChannelPatch, StreamChannelInput } from "../types/channel-input.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";

export const invalid = (field: string, message: string): AppError =>
  new AppError(ERRORS.channelInvalid, { field }, message);

/** The address rule of docs/03 section 7.3 applies to stream rows only (docs/26 decision D3). */
function checkAddresses(record: StreamRecord, allowLoopback: boolean): void {
  if (!isAcceptedAddress(record.streamUrl, allowLoopback)) {
    throw invalid("streamUrl", addressRefusal("stream address", allowLoopback));
  }
  if (record.logoUrl !== null && !isAcceptedAddress(record.logoUrl, allowLoopback)) {
    throw invalid("logoUrl", addressRefusal("logo address", allowLoopback));
  }
}

/** A hand-created stream row has no parent playlist, so no sync touches it (docs/03 section 7.2c). */
export function newStreamRecord(input: StreamChannelInput, id: string, allowLoopback: boolean): StreamRecord {
  const record: StreamRecord = {
    ...NOT_SYNCED,
    kind: "stream",
    id,
    name: input.name,
    category: input.category,
    number: input.number ?? null,
    logoUrl: input.logoUrl ?? null,
    tvgId: null,
    streamUrl: input.streamUrl,
    editedFields: [],
    revision: 0,
    enabled: true,
    published: true,
  };
  checkAddresses(record, allowLoopback);
  return record;
}

const TRACKED = ["name", "category", "number", "logoUrl", "streamUrl"] as const;

/**
 * A synced row remembers which fields an admin changed, so the next sync leaves them alone (docs/26 section 3.10,
 * rule 1). Only fields the change really altered are added; a hand-made row records nothing.
 */
export function withEdits(before: StreamRecord, after: StreamRecord): StreamRecord {
  if (before.playlistId === null) return after;
  const changed = TRACKED.filter((field) => before[field] !== after[field]);
  return { ...after, editedFields: [...new Set([...before.editedFields, ...changed])] };
}

const LIVE_ONLY = ["mode", "captions", "variants", "folder", "videos"] as const;

export function patchedStreamRecord(current: StreamRecord, patch: ChannelPatch, allowLoopback: boolean): StreamRecord {
  for (const field of LIVE_ONLY) {
    if (patch[field] !== undefined) throw invalid(field, `A stream channel has no ${field}; it belongs to a live channel.`);
  }
  const number = patch.number === undefined ? current.number : String(patch.number);
  if (number !== null && (number.length < 1 || number.length > CHANNEL_NUMBER_MAX)) {
    throw invalid("number", "The number is not valid.");
  }
  const record: StreamRecord = {
    ...current,
    name: patch.name ?? current.name,
    category: patch.category ?? current.category,
    number,
    logoUrl: patch.logoUrl ?? current.logoUrl,
    streamUrl: patch.streamUrl ?? current.streamUrl,
  };
  checkAddresses(record, allowLoopback);
  return record;
}
